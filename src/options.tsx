import { AttachmentIcon, CheckIcon, DownloadIcon } from "@chakra-ui/icons";
import { Box, Button, ChakraProvider, Container, Heading, HStack, StackDivider, useToast, VisuallyHiddenInput, VStack } from "@chakra-ui/react";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import useI18n from "./useI18n";

type JsonData = {
  targetDomain: string[];
  dispBanner: boolean;
  blockRequest: boolean;
  postAlert: boolean;
};

const Options = () => {
  const [fileName, setFileName] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const message = useI18n();

  const toast = useToast();

  const chooseFileClick = () => {
    fileInputRef.current?.click();
  };

  // ファイル選択時の処理
  const changeFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === "application/json") {
        setFileName(selectedFile.name);
        setFile(selectedFile);
      } else {
        toast({
          title: message("import_setting_type_error_title"),
          description: message("import_setting_type_error_description"),
          status: "error",
          duration: 3000,
          isClosable: true,
          containerStyle: {maxWidth: '100px'}
        });
      }
    }
  };

  // JSON形式のバリデーション
  const validateJson = (data: any): data is JsonData => {
    return (
      Array.isArray(data.targetDomain) &&
      data.targetDomain.every((item: any) => typeof item === "string") &&
      typeof data.dispBanner === "boolean" &&
      typeof data.postAlert === "boolean"
    );
  };

  // インポートボタンクリック時の処理
  const importData = () => {
    if (!file) {
      toast({
        title: message("import_setting_select_error_title"),
        status: "error",
        duration: 3000,
        isClosable: true,
        containerStyle: { maxWidth: "100px" },
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);
        if (!validateJson(jsonData)) {
          toast({
            title: message("import_setting_format_error_message"),
            status: "error",
            duration: 3000,
            isClosable: true,
            containerStyle: { maxWidth: "100px" },
          });
          return;
        }
        chrome.storage.local.set({targetDomain: jsonData.targetDomain});
        chrome.storage.local.set({dispBanner: jsonData.dispBanner == undefined || typeof(jsonData.dispBanner) !== 'boolean' ? true : jsonData.dispBanner});
        chrome.storage.local.set({blockRequest: jsonData.blockRequest == undefined || typeof(jsonData.blockRequest) !== 'boolean' ? true : jsonData.blockRequest});
        chrome.storage.local.set({postAlert: jsonData.postAlert == undefined || typeof(jsonData.postAlert) !== 'boolean' ? true : jsonData.postAlert});
        toast({
          title: message("import_setting_success_title"),
          description: message("import_setting_success_message"),
          status: "success",
          duration: 3000,
          isClosable: true,
          containerStyle: { maxWidth: "100px" },
        });
      } catch (e: any) {
        toast({
          title: message("import_setting_type_error_title"),
          description: e.message,
          status: "error",
          duration: 3000,
          isClosable: true,
          containerStyle: { maxWidth: "100px"}
        });
      }
    };
    reader.readAsText(file);
  };

  // エクスポートボタンクリック時の処理
  const exportData = () => {
    chrome.storage.local.get(["targetDomain", "dispBanner", "blockRequest", "postAlert"], (data) => {
      const jsonData = {
        targetDomain: data.targetDomain || [],
        dispBanner: data.dispBanner ?? true,
        blockRequest: data.blockRequest ?? true,
        postAlert: data.postAlert?? true
      };

      const blob = new Blob([JSON.stringify(jsonData, null, 2)], {type: "application/json"});
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "setting.json";
      a.click();

      URL.revokeObjectURL(url);

      toast({
        title: message("export_setting_success_title"),
        status: "success",
        duration: 3000,
        isClosable: true,
        containerStyle: { maxWidth: "100px" },
      });
    });
  }

  return (
    <Box h="500px" padding="15px">
      <Heading size="md">{message("option_title")}</Heading>
      <Container mt="20px" mb="20px">
        <VStack
          padding={0}
          align="stretch"
          divider={<StackDivider borderColor="gray.200" />}
          spacing={3}
        >
          <Box>
            <Heading as="h2" size="sm">
              {message("option_import_title")}
            </Heading>
            <Box pt={3}>{message("option_import_description")}</Box>
            <HStack
              pt={3}
              align="start"
              justify={"flex-start"}
              divider={<StackDivider borderColor="gray.200" />}
            >
              <Box>
                <Button
                  colorScheme={file ? "green" : "orange"}
                  display="block"
                  size="sm"
                  leftIcon={file ? <CheckIcon /> : <AttachmentIcon />}
                  onClick={chooseFileClick}
                >
                  {message("option_import_select_file_button")}
                </Button>
                <VisuallyHiddenInput
                  type="file"
                  ref={fileInputRef}
                  onChange={changeFile}
                  accept="application/json"
                />
                {fileName && <Box>{fileName}</Box>}
              </Box>
              {file && (
                <Button
                  colorScheme="orange"
                  display="block"
                  size="sm"
                  onClick={importData}
                >
                  {message("option_import_button")}
                </Button>
              )}
            </HStack>
          </Box>
          <Box>
            <Heading as="h2" size="sm">
              {message("option_export_title")}
            </Heading>
            <Box pt={3}>
              {message("option_export_description")}
            </Box>
            <VStack
              padding={0}
              pt={3}
              divider={<StackDivider borderColor="gray.200" />}
              spacing={3}
            >
              <Button
                colorScheme="orange"
                display="block"
                marginRight="auto"
                size="sm"
                leftIcon={<DownloadIcon />}
                onClick={exportData}
              >
                {message("option_export_button")}
              </Button>
            </VStack>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
};

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(
  <ChakraProvider>
    <Options />
  </ChakraProvider>
);