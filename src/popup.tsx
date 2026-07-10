/// <reference types="chrome" />
import {
  ChakraProvider,
  Box,
  FormLabel,
  Switch,
  Heading,
  Button,
  VStack,
  StackDivider,
  Input,
  useToast,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogCloseButton,
  AlertDialogBody,
  AlertDialogFooter,
  useDisclosure,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverBody,
  PopoverHeader,
  HStack,
  Flex,
  Text,
  Image,
  IconButton,
  Tooltip,
  Badge,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
} from "@chakra-ui/react";
import {
  AddIcon,
  EditIcon,
  CloseIcon,
  InfoOutlineIcon,
  SettingsIcon,
  TimeIcon,
} from "@chakra-ui/icons";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import useI18n from "./useI18n";

interface TargetDomain {
  targetDomain: string;
  isEdit: boolean;
}

// 一時停止に対応する機能のキー
type FeatureKey = "dispBanner" | "blockRequest" | "postAlert";
const FEATURE_KEYS: FeatureKey[] = ["dispBanner", "blockRequest", "postAlert"];
const pauseUntilKeyOf = (f: FeatureKey) => `${f}PauseUntil`;

// 残り時間（ミリ秒）を m:ss 形式に整形する
const formatRemaining = (ms: number) => {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

// <br> を JSX に変換する関数
const convertBrToJsx = (text: string) => {
  return text.split("<br>").map((line, index) => (
    <React.Fragment key={index}>
      {line}
      {index !== text.split("<br>").length - 1 && <br />}
    </React.Fragment>
  ));
};

interface SettingToggleProps {
  id: string;
  title: string;
  popoverBody: string;
  isChecked: boolean;
  onChange: () => void;
  onPauseClick: () => void;
  pauseLabel: string;
  remainingMs?: number | null;
  remainingLabel?: string;
}

// 設定トグル1行分の共通レイアウト
const SettingToggle = ({
  id,
  title,
  popoverBody,
  isChecked,
  onChange,
  onPauseClick,
  pauseLabel,
  remainingMs,
  remainingLabel,
}: SettingToggleProps) => {
  const isPaused = remainingMs != null && remainingMs > 0;
  return (
    <Flex align="center" justify="space-between" w="100%">
      <HStack spacing={1.5} align="center">
        <FormLabel
          htmlFor={id}
          mb="0"
          mr="0"
          fontSize="sm"
          fontWeight="medium"
          cursor="pointer"
        >
          {title}
        </FormLabel>
        <Popover isLazy>
          <PopoverTrigger>
            <InfoOutlineIcon
              boxSize={3.5}
              color="gray.400"
              cursor="pointer"
              _hover={{ color: "orange.400" }}
            />
          </PopoverTrigger>
          <PopoverContent maxW="230px" fontSize="sm">
            <PopoverArrow />
            <PopoverHeader fontWeight="semibold">{title}</PopoverHeader>
            <PopoverBody>{convertBrToJsx(popoverBody)}</PopoverBody>
          </PopoverContent>
        </Popover>
        {isPaused && (
          <Badge
            colorScheme="orange"
            variant="subtle"
            borderRadius="full"
            px={2}
            display="flex"
            alignItems="center"
            gap="3px"
            fontSize="0.65rem"
            textTransform="none"
          >
            <TimeIcon boxSize={2.5} />
            {remainingLabel} {formatRemaining(remainingMs!)}
          </Badge>
        )}
      </HStack>
      <HStack spacing={1}>
        {isChecked && (
          <Tooltip label={pauseLabel} fontSize="xs" hasArrow>
            <IconButton
              aria-label={pauseLabel}
              icon={<TimeIcon boxSize={3} />}
              size="xs"
              variant="ghost"
              colorScheme="orange"
              borderRadius="full"
              onClick={onPauseClick}
            />
          </Tooltip>
        )}
        <Switch
          id={id}
          colorScheme="orange"
          isChecked={isChecked}
          onChange={onChange}
        />
      </HStack>
    </Flex>
  );
};

const Popup = () => {
  const [targetDomainList, setTargetDomainList] = useState<TargetDomain[]>([]);
  const [isEditFlg, setIsEditFlg] = useState<boolean>(false);
  const [isDispBanner, setIsDispBanner] = useState<boolean>(false);
  const [isPostAlert, setIsPostAlert] = useState<boolean>(false);
  const [isBlockRequest, setIsBlockRequest] = useState<boolean>(false);
  const [blockPopupType, setBlockPopupType] = useState<string>("");
  // 各機能の一時停止終了時刻（epoch ms）。null なら一時停止中でない
  const [pauseUntil, setPauseUntil] = useState<Record<FeatureKey, number | null>>(
    { dispBanner: null, blockRequest: null, postAlert: null },
  );
  // 残り時間のカウントダウン用に毎秒更新する現在時刻
  const [now, setNow] = useState<number>(Date.now());
  const { isOpen, onOpen, onClose } = useDisclosure();
  // 一時停止モーダル用
  const {
    isOpen: isPauseOpen,
    onOpen: onPauseOpen,
    onClose: onPauseClose,
  } = useDisclosure();
  const [pauseTarget, setPauseTarget] = useState<FeatureKey | "all" | null>(null);
  // 「全機能一時停止」時、クリック時点でONだった機能のみを対象として保持する
  const [pauseAllTargets, setPauseAllTargets] = useState<FeatureKey[]>([]);
  const [pauseMinutes, setPauseMinutes] = useState<string>("10");
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const pauseCancelRef = React.useRef<HTMLButtonElement>(null);
  const toast = useToast();
  const message = useI18n();

  var url: string | undefined;
  chrome.tabs.query({ active: true, currentWindow: true }, (e) => {
    url = e[0].url;
  });

  useEffect(() => {
    chrome.storage.local.get(null, (data) => {
      const targetDomain: string[] =
        data.targetDomain == undefined ? [] : data.targetDomain;
      if (!(targetDomain == null || targetDomain.length == 0)) {
        var newTargetDomainList: TargetDomain[] = [];
        targetDomain.forEach((t) => {
          newTargetDomainList.push({ targetDomain: t, isEdit: false });
        });
        setTargetDomainList(newTargetDomainList);
        setIsDispBanner(data.dispBanner);
        setIsPostAlert(data.postAlert);
        setIsBlockRequest(data.blockRequest);
      }
      setPauseUntil({
        dispBanner: data.dispBannerPauseUntil ?? null,
        blockRequest: data.blockRequestPauseUntil ?? null,
        postAlert: data.postAlertPauseUntil ?? null,
      });
    });
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action === "openPopup:blockRequest") {
        // ポップアップを表示する処理
        setBlockPopupType("blockRequest");
        onOpen();
      } else if (msg.action === "openPopup:blockPostRequest") {
        // ポップアップを表示する処理
        setBlockPopupType("blockPostRequest");
        onOpen();
      }
    });
  }, []);

  // カウントダウン用の現在時刻を毎秒更新
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // ストレージ変更を監視し、UIの状態を同期する
  // （一時停止時間終了時のバックグラウンドによる自動オンなどを反映）
  useEffect(() => {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) => {
      if (area !== "local") return;
      if (changes.dispBanner) setIsDispBanner(!!changes.dispBanner.newValue);
      if (changes.blockRequest)
        setIsBlockRequest(!!changes.blockRequest.newValue);
      if (changes.postAlert) setIsPostAlert(!!changes.postAlert.newValue);
      if (changes.dispBannerPauseUntil)
        setPauseUntil((p) => ({
          ...p,
          dispBanner: changes.dispBannerPauseUntil.newValue ?? null,
        }));
      if (changes.blockRequestPauseUntil)
        setPauseUntil((p) => ({
          ...p,
          blockRequest: changes.blockRequestPauseUntil.newValue ?? null,
        }));
      if (changes.postAlertPauseUntil)
        setPauseUntil((p) => ({
          ...p,
          postAlert: changes.postAlertPauseUntil.newValue ?? null,
        }));
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  // 機能のチェック状態を取得／更新するヘルパー
  const isCheckedOf = (f: FeatureKey) =>
    f === "dispBanner"
      ? isDispBanner
      : f === "blockRequest"
        ? isBlockRequest
        : isPostAlert;

  const setChecked = (f: FeatureKey, v: boolean) => {
    if (f === "dispBanner") setIsDispBanner(v);
    else if (f === "blockRequest") setIsBlockRequest(v);
    else setIsPostAlert(v);
  };

  // 機能名（i18n）
  const featureLabelOf = (f: FeatureKey) =>
    f === "dispBanner"
      ? message("popup_setting_disp_banner_title")
      : f === "blockRequest"
        ? message("popup_setting_block_request_title")
        : message("popup_setting_block_post_request_title");

  // 有効化トースト（i18n）
  const resumeToastTitleOf = (f: FeatureKey) =>
    f === "dispBanner"
      ? message("change_setting_disp_banner_toast_title_on")
      : f === "blockRequest"
        ? message("change_setting_block_request_toast_title_on")
        : message("change_setting_post_alert_toast_title_on");

  // 無効化（恒久オフ）トースト（i18n）
  const turnOffToastTitleOf = (f: FeatureKey) =>
    f === "dispBanner"
      ? message("change_setting_disp_banner_toast_title_off")
      : f === "blockRequest"
        ? message("change_setting_block_request_toast_title_off")
        : message("change_setting_post_alert_toast_title_off");

  // アクティブタブのコンテンツスクリプトへ再描画を通知する
  const notifyContentScript = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId != null) {
        chrome.tabs
          .sendMessage(tabId, { target: "honbanAlertHandler:contentScript" })
          .catch(() => {});
      }
    });
  };

  // 機能を一時停止する（設定オフ＋終了時刻の保存＋復帰アラーム作成）
  const applyPause = (f: FeatureKey, until: number) => {
    setChecked(f, false);
    setPauseUntil((prev) => ({ ...prev, [f]: until }));
    chrome.storage.local.set({ [f]: false, [pauseUntilKeyOf(f)]: until });
    chrome.alarms.create(`pause:${f}`, { when: until });
  };

  // 機能を有効に戻す（手動オン。タイマーをリセットして一時停止を終了）
  const resumeFeature = (f: FeatureKey, silent = false) => {
    setChecked(f, true);
    setPauseUntil((prev) => ({ ...prev, [f]: null }));
    chrome.storage.local.set({ [f]: true, [pauseUntilKeyOf(f)]: null });
    chrome.alarms.clear(`pause:${f}`);
    notifyContentScript();
    if (!silent) {
      toast({
        title: resumeToastTitleOf(f),
        description: message("change_setting_toast_description"),
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // 機能を恒久的にオフにする（タイマーなし）
  const turnOffFeature = (f: FeatureKey) => {
    setChecked(f, false);
    setPauseUntil((prev) => ({ ...prev, [f]: null }));
    chrome.storage.local.set({ [f]: false, [pauseUntilKeyOf(f)]: null });
    chrome.alarms.clear(`pause:${f}`);
    notifyContentScript();
    toast({
      title: turnOffToastTitleOf(f),
      description: message("change_setting_toast_description"),
      status: "success",
      duration: 3000,
      isClosable: true,
    });
  };

  // トグル操作時のハンドラ（タイマーなしの恒久オン／オフ）
  // ON→OFF: 恒久的に無効化 / OFF→ON: 手動で有効化（一時停止中であれば解除）
  const handleToggle = (f: FeatureKey) => {
    if (isCheckedOf(f)) {
      turnOffFeature(f);
    } else {
      resumeFeature(f);
    }
  };

  // 一時停止アイコンクリック時のハンドラ（単一機能）
  const openPauseSingle = (f: FeatureKey) => {
    setPauseTarget(f);
    setPauseMinutes("10");
    onPauseOpen();
  };

  // 全機能を一時停止するモーダルを開く（クリック時点でONの機能のみを対象とする）
  const openPauseAll = () => {
    const onFeatures = FEATURE_KEYS.filter((f) => isCheckedOf(f));
    if (onFeatures.length === 0) return;
    setPauseAllTargets(onFeatures);
    setPauseTarget("all");
    setPauseMinutes("10");
    onPauseOpen();
  };

  // 一時停止中の全機能を有効に戻す（もともとONだった機能のみが対象になる）
  const resumeAll = () => {
    const pausedFeatures = FEATURE_KEYS.filter((f) => {
      const u = pauseUntil[f];
      return u != null && u > now;
    });
    pausedFeatures.forEach((f) => resumeFeature(f, true));
    notifyContentScript();
    toast({
      title: message("popup_resume_all_toast_title"),
      description: message("change_setting_toast_description"),
      status: "success",
      duration: 3000,
      isClosable: true,
    });
  };

  // モーダルで「一時停止する」を押したときの処理
  const confirmPause = () => {
    let minutes = parseInt(pauseMinutes, 10);
    if (isNaN(minutes) || minutes < 1) minutes = 10;
    if (minutes > 999) minutes = 999;
    // until の起点と now を同じ時刻に同期させ、カウントダウン開始直後に
    // 1秒以内の描画ラグ（setInterval の未更新分）で残り時間が繰り上がらないようにする
    const nowMs = Date.now();
    const until = nowMs + minutes * 60 * 1000;
    setNow(nowMs);
    const targets: FeatureKey[] =
      pauseTarget === "all"
        ? pauseAllTargets
        : pauseTarget
          ? [pauseTarget]
          : [];
    targets.forEach((f) => applyPause(f, until));
    notifyContentScript();
    const label =
      pauseTarget === "all"
        ? message("popup_pause_all_label")
        : pauseTarget
          ? featureLabelOf(pauseTarget)
          : "";
    toast({
      title: message("change_setting_pause_toast_title", [label, String(minutes)]),
      description: message("change_setting_pause_toast_description"),
      status: "success",
      duration: 3000,
      isClosable: true,
    });
    setPauseTarget(null);
    setPauseAllTargets([]);
    onPauseClose();
  };

  // いずれかの機能が一時停止中か
  const anyPaused = FEATURE_KEYS.some((f) => {
    const u = pauseUntil[f];
    return u != null && u > now;
  });

  // いずれかの機能が現在ONか（一時停止対象があるか）
  const anyOn = FEATURE_KEYS.some((f) => isCheckedOf(f));

  // 一時停止中の機能について、残り時間（ミリ秒）を返す
  const remainingMsOf = (f: FeatureKey) => {
    const u = pauseUntil[f];
    return u != null && u > now ? u - now : null;
  };

  const changeTextHandler = (text: string, index: number) => {
    var newDomainList = [...targetDomainList];
    newDomainList[index].targetDomain = text;
    setTargetDomainList(newDomainList);
  };

  const editButtonHandler = (index: number) => {
    var newDomainList = [...targetDomainList];
    newDomainList[index].isEdit = true;
    setTargetDomainList(newDomainList);
    setIsEditFlg(true);
  };

  const deleteButtonHandler = (index: number) => {
    var newDomainList = [...targetDomainList];
    newDomainList.splice(index, 1);
    setTargetDomainList(newDomainList);
    setIsEditFlg(true);
  };

  const addButtonHandler = () => {
    var newDomainList = [...targetDomainList];
    newDomainList.push({ targetDomain: "", isEdit: true });
    setTargetDomainList(newDomainList);
    setIsEditFlg(true);
  };

  const saveButtonHandler = () => {
    const newDomainList = targetDomainList.map((t) => {
      t.isEdit = false;
      return t;
    });
    chrome.storage.local.set({
      targetDomain: newDomainList.map((t) => t.targetDomain),
    });
    setTargetDomainList(newDomainList);
    setIsEditFlg(false);
    toast({
      title: message("change_setting_domain_toast_title"),
      description: message("change_setting_toast_description"),
      status: "success",
      duration: 9000,
      isClosable: true,
    });
    if (url != undefined) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id!, {
          target: "honbanAlertHandler:contentScript",
        });
      });
    }
  };

  return (
    <Box w="320px" bg="gray.50" minH="100%">
      {/* ヘッダー */}
      <Flex
        align="center"
        gap="10px"
        px="16px"
        py="14px"
        bgGradient="linear(to-r, orange.500, orange.400)"
        color="white"
      >
        <Flex
          align="center"
          justify="center"
          boxSize="32px"
          bg="whiteAlpha.300"
          borderRadius="8px"
          flexShrink={0}
        >
          <Image src="honban_alert_icon.png" alt="" boxSize="20px" />
        </Flex>
        <Heading size="sm" fontWeight="bold" letterSpacing="tight">
          {message("popup_title")}
        </Heading>
      </Flex>

      <Box px="16px" py="16px">
        {/* 設定カード */}
        <Flex align="center" justify="space-between" mb="8px">
          <Text
            fontSize="xs"
            fontWeight="bold"
            color="gray.500"
            textTransform="uppercase"
            letterSpacing="wide"
          >
            {/* 設定 */}
            {message("popup_setting_title")}
          </Text>
          {anyPaused ? (
            <Button
              size="xs"
              variant="ghost"
              colorScheme="orange"
              leftIcon={<TimeIcon boxSize={3} />}
              onClick={resumeAll}
            >
              {message("popup_resume_all_button")}
            </Button>
          ) : (
            <Button
              size="xs"
              variant="ghost"
              colorScheme="orange"
              leftIcon={<TimeIcon boxSize={3} />}
              onClick={openPauseAll}
              isDisabled={!anyOn}
            >
              {message("popup_pause_all_button")}
            </Button>
          )}
        </Flex>
        <Box
          bg="white"
          borderRadius="12px"
          borderWidth="1px"
          borderColor="gray.200"
          boxShadow="sm"
          px="14px"
          py="4px"
        >
          <VStack
            divider={<StackDivider borderColor="gray.100" />}
            spacing={0}
            align="stretch"
          >
            <Box py="10px">
              <SettingToggle
                id="disp-banner"
                title={message("popup_setting_disp_banner_title")}
                popoverBody={message("popover_disp_banner_body")}
                isChecked={isDispBanner}
                onChange={() => handleToggle("dispBanner")}
                onPauseClick={() => openPauseSingle("dispBanner")}
                pauseLabel={message("popup_pause_button_label")}
                remainingMs={remainingMsOf("dispBanner")}
                remainingLabel={message("popup_pause_remaining_label")}
              />
            </Box>
            <Box py="10px">
              <SettingToggle
                id="block-request"
                title={message("popup_setting_block_request_title")}
                popoverBody={message("popover_block_request_body")}
                isChecked={isBlockRequest}
                onChange={() => handleToggle("blockRequest")}
                onPauseClick={() => openPauseSingle("blockRequest")}
                pauseLabel={message("popup_pause_button_label")}
                remainingMs={remainingMsOf("blockRequest")}
                remainingLabel={message("popup_pause_remaining_label")}
              />
            </Box>
            <Box py="10px">
              <SettingToggle
                id="post-alert"
                title={message("popup_setting_block_post_request_title")}
                popoverBody={message("popover_block_post_request_body")}
                isChecked={isPostAlert}
                onChange={() => handleToggle("postAlert")}
                onPauseClick={() => openPauseSingle("postAlert")}
                pauseLabel={message("popup_pause_button_label")}
                remainingMs={remainingMsOf("postAlert")}
                remainingLabel={message("popup_pause_remaining_label")}
              />
            </Box>
          </VStack>
        </Box>

        {/* 対象ドメインカード */}
        <Flex align="center" justify="space-between" mt="16px" mb="8px">
          <HStack spacing={1.5} align="center">
            <Text
              fontSize="xs"
              fontWeight="bold"
              color="gray.500"
              textTransform="uppercase"
              letterSpacing="wide"
            >
              {/* 対象ドメイン */}
              {message("popup_setting_target_domain_title")}
            </Text>
            <Popover isLazy>
              <PopoverTrigger>
                <InfoOutlineIcon
                  boxSize={3.5}
                  color="gray.400"
                  cursor="pointer"
                  _hover={{ color: "orange.400" }}
                />
              </PopoverTrigger>
              <PopoverContent maxW="230px" maxH="230px" fontSize="sm">
                <PopoverArrow />
                <PopoverHeader fontWeight="semibold">
                  {message("popup_setting_target_domain_title")}
                </PopoverHeader>
                <PopoverBody
                  overflowY="auto"
                  sx={{
                    scrollbarWidth: "none",
                    "&::-webkit-scrollbar": { display: "none" },
                  }}
                >
                  {convertBrToJsx(message("popover_target_domain_body"))}
                </PopoverBody>
              </PopoverContent>
            </Popover>
          </HStack>
          <Tooltip label="＋ 追加" fontSize="xs" hasArrow>
            <IconButton
              aria-label="add domain"
              icon={<AddIcon boxSize={3} />}
              size="xs"
              variant="ghost"
              colorScheme="orange"
              borderRadius="full"
              onClick={() => addButtonHandler()}
            />
          </Tooltip>
        </Flex>
        <Box
          bg="white"
          borderRadius="12px"
          borderWidth="1px"
          borderColor="gray.200"
          boxShadow="sm"
          px="12px"
          py="12px"
        >
          <VStack align="stretch" spacing={2}>
            {targetDomainList.length === 0 && (
              <Text fontSize="sm" color="gray.400" textAlign="center" py="8px">
                {/* 未登録時 */}＋ から対象ドメインを追加
              </Text>
            )}
            {targetDomainList.map((data, index) => (
              <Flex align="center" gap="8px" key={index}>
                <Input
                  placeholder="^example.com$"
                  size="sm"
                  borderRadius="8px"
                  focusBorderColor="orange.500"
                  value={data.targetDomain}
                  variant={data.isEdit ? "outline" : "filled"}
                  isReadOnly={!data.isEdit}
                  onChange={(e) => changeTextHandler(e.target.value, index)}
                />
                <IconButton
                  aria-label="edit domain"
                  icon={<EditIcon boxSize={3.5} />}
                  size="xs"
                  variant="ghost"
                  colorScheme="gray"
                  onClick={() => editButtonHandler(index)}
                />
                <IconButton
                  aria-label="delete domain"
                  icon={<CloseIcon boxSize={2.5} />}
                  size="xs"
                  variant="ghost"
                  colorScheme="red"
                  onClick={() => deleteButtonHandler(index)}
                />
              </Flex>
            ))}
            {isEditFlg && (
              <Button
                colorScheme="orange"
                alignSelf="flex-end"
                size="sm"
                borderRadius="8px"
                px="20px"
                mt="4px"
                onClick={() => saveButtonHandler()}
              >
                {/* 保存 */}
                {message("popup_setting_save_button")}
              </Button>
            )}
          </VStack>
        </Box>

        {/* オプション */}
        <Button
          leftIcon={<SettingsIcon boxSize={3.5} />}
          variant="outline"
          colorScheme="gray"
          w="100%"
          size="sm"
          borderRadius="8px"
          mt="16px"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          {/* オプション */}
          {message("popup_option_button")}
        </Button>
      </Box>
      {/* アラートモーダル */}
      <AlertDialog
        motionPreset="slideInBottom"
        leastDestructiveRef={cancelRef}
        onClose={onClose}
        isOpen={isOpen}
        isCentered
      >
        <AlertDialogOverlay />

        <AlertDialogContent w="90%" borderRadius="12px">
          <AlertDialogHeader
            display="flex"
            alignItems="center"
            gap="8px"
            color="red.500"
            fontSize="md"
          >
            <InfoOutlineIcon boxSize={4} />
            {message("popup_blocked_alert_modal_title")}
          </AlertDialogHeader>
          <AlertDialogCloseButton />
          <AlertDialogBody fontSize="sm">
            {blockPopupType === "blockRequest" &&
              convertBrToJsx(message("popup_blocked_alert_modal_message"))}
            {blockPopupType === "blockPostRequest" &&
              convertBrToJsx(message("popup_post_blocked_alert_modal_message"))}
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button
              colorScheme="red"
              borderRadius="8px"
              ref={cancelRef}
              onClick={onClose}
            >
              {message("popup_blocked_alert_modal_close_button")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* 一時停止モーダル */}
      <AlertDialog
        motionPreset="slideInBottom"
        leastDestructiveRef={pauseCancelRef}
        onClose={onPauseClose}
        isOpen={isPauseOpen}
        isCentered
      >
        <AlertDialogOverlay />
        <AlertDialogContent w="90%" borderRadius="12px">
          <AlertDialogHeader
            display="flex"
            alignItems="center"
            gap="8px"
            color="orange.500"
            fontSize="md"
          >
            <TimeIcon boxSize={4} />
            {message("popup_pause_modal_title")}
          </AlertDialogHeader>
          <AlertDialogCloseButton />
          <AlertDialogBody fontSize="sm">
            <Text mb="4px">
              {message("popup_pause_modal_target", [
                pauseTarget === "all"
                  ? message("popup_pause_all_label")
                  : pauseTarget
                    ? featureLabelOf(pauseTarget)
                    : "",
              ])}
            </Text>
            <Text mb="12px" color="gray.500" fontSize="xs">
              {message("popup_pause_modal_description")}
            </Text>
            <FormLabel fontSize="sm" fontWeight="medium" mb="4px">
              {message("popup_pause_modal_minutes_label")}
            </FormLabel>
            <NumberInput
              min={1}
              max={999}
              value={pauseMinutes}
              onChange={(v) => setPauseMinutes(v)}
              size="sm"
              focusBorderColor="orange.500"
            >
              <NumberInputField borderRadius="8px" />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </AlertDialogBody>
          <AlertDialogFooter gap="8px">
            <Button
              ref={pauseCancelRef}
              onClick={onPauseClose}
              variant="ghost"
              borderRadius="8px"
              size="sm"
            >
              {message("popup_pause_modal_cancel_button")}
            </Button>
            <Button
              colorScheme="orange"
              borderRadius="8px"
              size="sm"
              onClick={confirmPause}
            >
              {message("popup_pause_modal_confirm_button")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  );
};

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(
  <ChakraProvider>
    <Popup />
  </ChakraProvider>,
);
