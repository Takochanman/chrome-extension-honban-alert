import { ChakraProvider, Box, FormLabel, Switch, Heading, Button, VStack, Container, StackDivider, Input, useToast, AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogCloseButton, AlertDialogBody, AlertDialogFooter, useDisclosure, Divider, Skeleton } from "@chakra-ui/react";
import { AddIcon, EditIcon, CloseIcon } from "@chakra-ui/icons";
import React, { useEffect, useState } from "react";
import { createRoot } from 'react-dom/client';
import useI18n from "./useI18n";

interface TargetDomain {
  targetDomain: string,
  isEdit: boolean
}

const Popup = () => {
  const [targetDomainList, setTargetDomainList] = useState<TargetDomain[]>([]);
  const [isEditFlg, setIsEditFlg] = useState<boolean>(false);
  const [isDispBanner, setIsDispBanner] = useState<boolean>(false);
  const [isPostAlert, setIsPostAlert] = useState<boolean>(false);
  const [isBlockRequest, setIsBlockRequest] = useState<boolean>(false);
  const {isOpen, onOpen, onClose} = useDisclosure();
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const toast = useToast();
  const message = useI18n();

  var url: string | undefined;
  chrome.tabs.query({ active: true, currentWindow: true }, (e) => {
    url = e[0].url;
  });

  useEffect(() => {
    chrome.storage.local.get(null, (data) => {
      const targetDomain: string[] = data.targetDomain == undefined ? [] : data.targetDomain;
      if (!(targetDomain == null || targetDomain.length == 0)) {
        var newTargetDomainList: TargetDomain[] = [];
        targetDomain.forEach((t) => {
          newTargetDomainList.push({targetDomain: t, isEdit: false});
        });
        setTargetDomainList(newTargetDomainList);
        setIsDispBanner(data.dispBanner);
        setIsPostAlert(data.postAlert);
        setIsBlockRequest(data.blockRequest);
      }
    });
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action === "openPopup") {
        // ポップアップを表示する処理
        onOpen();
      }
    });
  }, []);

  // バナー表示の切り替え
  const changeDispBanner = () => {
    setIsDispBanner(!isDispBanner);
    chrome.storage.local.set({dispBanner: !isDispBanner});
    toast({
      title: !isDispBanner ? message("change_setting_disp_banner_toast_title_on") : message("change_setting_disp_banner_toast_title_off"),
      description: message("change_setting_toast_description"),
      status: "success",
      duration: 3000,
      isClosable: true,
      containerStyle: {maxWidth: '100px'}
    });
    if (url != undefined) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id!, {
          target: "honbanAlertHandler:contentScript",
        });
      });
    }
  }

  // リクエストブロックの切り替え
  const changeBlockRequest = () => {
    setIsBlockRequest(!isBlockRequest);
    chrome.storage.local.set({ blockRequest: !isBlockRequest });
    toast({
      title: !isBlockRequest ? message("change_setting_block_request_toast_title_on") : message("change_setting_block_request_toast_title_off"),
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
      title: !isPostAlert ? message("change_setting_post_alert_toast_title_on") : message("change_setting_post_alert_toast_title_off"),
      description: message("change_setting_toast_description"),
      status: "success",
      duration: 3000,
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

  const changeTextHandler = (text: string, index: number) => {
    var newDomainList = [...targetDomainList];
    newDomainList[index].targetDomain = text;
    setTargetDomainList(newDomainList);
  }

  const editButtonHandler = (index: number) => {
    var newDomainList = [...targetDomainList];
    newDomainList[index].isEdit = true;
    setTargetDomainList(newDomainList);
    setIsEditFlg(true);
  }

  const deleteButtonHandler = (index: number) => {
    var newDomainList = [...targetDomainList];
    newDomainList.splice(index, 1);
    setTargetDomainList(newDomainList);
    setIsEditFlg(true);
  }

  const addButtonHandler = () => {
    var newDomainList = [...targetDomainList];
    newDomainList.push({targetDomain: "", isEdit: true});
    setTargetDomainList(newDomainList);
    setIsEditFlg(true);
  }

  const saveButtonHandler = () => {
    const newDomainList = targetDomainList.map(t => {
      t.isEdit = false;
      return t;
    })
    chrome.storage.local.set({targetDomain: newDomainList.map(t => t.targetDomain)})
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
      chrome.tabs.query({active: true, currentWindow: true}, tabs => {
        chrome.tabs.sendMessage(tabs[0].id!, {
          target: 'honbanAlertHandler:contentScript'
        })
      });
    }
  }
  return (
    <Box w="300px" h="500px" padding="15px" overflow="hidden scroll">
      {/* 本番環境アラート */}
      <Heading size="md">{message("popup_title")}</Heading>
      <Container mt="20px" mb="20px">
        <Heading as="h2" size="sm">
          {/* 設定 */}
          {message("popup_setting_title")}
        </Heading>
        <VStack
          padding={0}
          pt={3}
          divider={<StackDivider borderColor="gray.200" />}
          spacing={3}
        >
          <Container display="flex" padding={0} alignItems="center">
            <FormLabel htmlFor="disp-banner" mb="0">
              {/* バナー表示 */}
              {message("popup_setting_disp_banner_title")}
            </FormLabel>
            <Switch
              id="disp-banner"
              colorScheme="orange"
              isChecked={isDispBanner}
              onChange={changeDispBanner}
            />
          </Container>
          <Container display="flex" padding={0} alignItems="center">
            <FormLabel htmlFor="block-request" mb="0">
              {/* リクエストブロック */}
              {message("popup_setting_block_request_title")}
            </FormLabel>
            <Switch
              id="block-request"
              colorScheme="orange"
              isChecked={isBlockRequest}
              onChange={changeBlockRequest}
            />
          </Container>
          <Container display="flex" padding={0} alignItems="center">
            <FormLabel htmlFor="post-alert" mb="0">
              {/* POSTアラート */}
              {message("popup_setting_post_alert_title")}
            </FormLabel>
            <Switch
              id="post-alert"
              colorScheme="orange"
              isChecked={isPostAlert}
              onChange={changePostAlert}
            />
          </Container>
          <Container padding={0}>
            <FormLabel htmlFor="target-domain" mb="0">
              {/* 対象ドメイン */}
              {message("popup_setting_target_domain_title")}
            </FormLabel>
            <VStack
              align="stretch"
              pl="5px"
              pt="10px"
              pb="20px"
              spacing={3}
              divider={<StackDivider borderColor="gray.200" />}
            >
              {targetDomainList.map((data, index) => (
                <Container
                  display="flex"
                  padding={0}
                  alignItems="center"
                  ml="5px"
                  key={index}
                >
                  <Input
                    placeholder="^example.com$"
                    size="sm"
                    focusBorderColor="orange.500"
                    mr="10px"
                    value={data.targetDomain}
                    variant={data.isEdit ? "outline" : "filled"}
                    isReadOnly={!data.isEdit}
                    onChange={(e) => changeTextHandler(e.target.value, index)}
                  />
                  <EditIcon
                    boxSize={4}
                    cursor="pointer"
                    display="block"
                    mr="10px"
                    onClick={() => editButtonHandler(index)}
                  />
                  <CloseIcon
                    boxSize={3}
                    cursor="pointer"
                    display="block"
                    onClick={() => deleteButtonHandler(index)}
                  />
                </Container>
              ))}
              <AddIcon
                boxSize={4}
                cursor="pointer"
                display="block"
                ml="5px"
                onClick={() => addButtonHandler()}
              />
            </VStack>
            <VStack>
              {isEditFlg && (
                <Button
                  colorScheme="orange"
                  w="80px"
                  display="block"
                  marginLeft="auto"
                  size="sm"
                  onClick={() => saveButtonHandler()}
                >
                  {/* 保存 */}
                  {message("popup_setting_save_button")}
                </Button>
              )}
            </VStack>
          </Container>
        </VStack>
        <Divider
          opacity={1}
          borderBottomWidth="1px"
          borderColor="gray.200"
          mt={3}
          mb={3}
        />
        <Button
          // colorScheme="gray"
          bg="gray.300"
          w="100px"
          display="block"
          marginLeft="auto"
          size="sm"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          {/* オプション */}
          {message("popup_option_button")}
        </Button>
      </Container>
      {/* アラートモーダル */}
      <AlertDialog
        motionPreset="slideInBottom"
        leastDestructiveRef={cancelRef}
        onClose={onClose}
        isOpen={isOpen}
        isCentered
      >
        <AlertDialogOverlay />

        <AlertDialogContent w="90%">
          <AlertDialogHeader>
            {message("popup_blocked_alert_modal_title")}
          </AlertDialogHeader>
          <AlertDialogCloseButton />
          <AlertDialogBody>
            {message("popup_blocked_alert_modal_message")}
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button colorScheme="red" ref={cancelRef} onClick={onClose}>
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
    <Popup/>
  </ChakraProvider>
);