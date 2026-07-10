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
} from "@chakra-ui/react";
import {
  AddIcon,
  EditIcon,
  CloseIcon,
  InfoOutlineIcon,
  SettingsIcon,
} from "@chakra-ui/icons";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import useI18n from "./useI18n";

interface TargetDomain {
  targetDomain: string;
  isEdit: boolean;
}

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
}

// 設定トグル1行分の共通レイアウト
const SettingToggle = ({
  id,
  title,
  popoverBody,
  isChecked,
  onChange,
}: SettingToggleProps) => {
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
      </HStack>
      <Switch
        id={id}
        colorScheme="orange"
        isChecked={isChecked}
        onChange={onChange}
      />
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
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = React.useRef<HTMLButtonElement>(null);
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

  // バナー表示の切り替え
  const changeDispBanner = () => {
    setIsDispBanner(!isDispBanner);
    chrome.storage.local.set({ dispBanner: !isDispBanner });
    toast({
      title: !isDispBanner
        ? message("change_setting_disp_banner_toast_title_on")
        : message("change_setting_disp_banner_toast_title_off"),
      description: message("change_setting_toast_description"),
      status: "success",
      duration: 3000,
      isClosable: true,
      containerStyle: { maxWidth: "100px" },
    });
    if (url != undefined) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id!, {
          target: "honbanAlertHandler:contentScript",
        });
      });
    }
  };

  // リクエストブロックの切り替え
  const changeBlockRequest = () => {
    setIsBlockRequest(!isBlockRequest);
    chrome.storage.local.set({ blockRequest: !isBlockRequest });
    toast({
      title: !isBlockRequest
        ? message("change_setting_block_request_toast_title_on")
        : message("change_setting_block_request_toast_title_off"),
      description: message("change_setting_toast_description"),
      status: "success",
      duration: 3000,
      isClosable: true,
    });
  };

  // POSTアラートの切り替え
  const changePostAlert = () => {
    setIsPostAlert(!isPostAlert);
    chrome.storage.local.set({ postAlert: !isPostAlert });
    toast({
      title: !isPostAlert
        ? message("change_setting_post_alert_toast_title_on")
        : message("change_setting_post_alert_toast_title_off"),
      description: message("change_setting_toast_description"),
      status: "success",
      duration: 3000,
      isClosable: true,
    });
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
        <Text
          fontSize="xs"
          fontWeight="bold"
          color="gray.500"
          textTransform="uppercase"
          letterSpacing="wide"
          mb="8px"
        >
          {/* 設定 */}
          {message("popup_setting_title")}
        </Text>
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
                onChange={changeDispBanner}
              />
            </Box>
            <Box py="10px">
              <SettingToggle
                id="block-request"
                title={message("popup_setting_block_request_title")}
                popoverBody={message("popover_block_request_body")}
                isChecked={isBlockRequest}
                onChange={changeBlockRequest}
              />
            </Box>
            <Box py="10px">
              <SettingToggle
                id="post-alert"
                title={message("popup_setting_block_post_request_title")}
                popoverBody={message("popover_block_post_request_body")}
                isChecked={isPostAlert}
                onChange={changePostAlert}
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
