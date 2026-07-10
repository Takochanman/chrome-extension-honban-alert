/// <reference types="chrome" />
import {
  ChakraProvider,
  Box,
  Flex,
  Heading,
  Text,
  Badge,
  Button,
  VStack,
  HStack,
  Image,
  Icon,
} from "@chakra-ui/react";
import { TimeIcon, SettingsIcon, ChatIcon } from "@chakra-ui/icons";
import React from "react";
import { createRoot } from "react-dom/client";
import useI18n from "./useI18n";

const FEATURE_ICONS = [TimeIcon, SettingsIcon, ChatIcon];

const Update = () => {
  const message = useI18n();
  const version = chrome.runtime.getManifest().version;

  const features = [
    {
      title: message("update_feature_pause_title"),
      description: message("update_feature_pause_description"),
    },
    {
      title: message("update_feature_ui_title"),
      description: message("update_feature_ui_description"),
    },
    {
      title: message("update_feature_toast_title"),
      description: message("update_feature_toast_description"),
    },
  ];

  return (
    <Box
      minH="100vh"
      bg="gray.50"
      display="flex"
      alignItems="center"
      justifyContent="center"
      py="40px"
    >
      <Box
        w="480px"
        maxW="90vw"
        bg="white"
        borderRadius="16px"
        borderWidth="1px"
        borderColor="gray.200"
        boxShadow="lg"
        overflow="hidden"
      >
        {/* ヘッダー */}
        <Flex
          direction="column"
          align="center"
          gap="10px"
          px="24px"
          py="32px"
          bgGradient="linear(to-r, orange.500, orange.400)"
          color="white"
        >
          <Flex
            align="center"
            justify="center"
            boxSize="48px"
            bg="whiteAlpha.300"
            borderRadius="12px"
            flexShrink={0}
          >
            <Image src="honban_alert_icon.png" alt="" boxSize="30px" />
          </Flex>
          <Heading size="md" fontWeight="bold" letterSpacing="tight">
            {message("update_title")}
          </Heading>
          <Badge
            colorScheme="whiteAlpha"
            bg="whiteAlpha.300"
            color="white"
            borderRadius="full"
            px="10px"
            py="2px"
            fontSize="0.75rem"
          >
            v{version}
          </Badge>
        </Flex>

        <Box px="24px" py="24px">
          <Text fontSize="sm" color="gray.600" mb="20px">
            {message("update_intro")}
          </Text>

          <VStack align="stretch" spacing="12px">
            {features.map((feature, index) => (
              <HStack
                key={index}
                align="start"
                spacing="12px"
                bg="orange.50"
                borderRadius="12px"
                borderWidth="1px"
                borderColor="orange.100"
                px="14px"
                py="12px"
              >
                <Flex
                  align="center"
                  justify="center"
                  boxSize="28px"
                  bg="white"
                  borderRadius="8px"
                  flexShrink={0}
                  boxShadow="sm"
                >
                  <Icon
                    as={FEATURE_ICONS[index]}
                    boxSize={3.5}
                    color="orange.500"
                  />
                </Flex>
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" color="gray.700">
                    {feature.title}
                  </Text>
                  <Text fontSize="xs" color="gray.600" mt="2px">
                    {feature.description}
                  </Text>
                </Box>
              </HStack>
            ))}
          </VStack>

          <Button
            colorScheme="orange"
            w="100%"
            size="sm"
            borderRadius="8px"
            mt="24px"
            onClick={() => window.close()}
          >
            {message("update_close_button")}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(
  <ChakraProvider>
    <Update />
  </ChakraProvider>,
);
