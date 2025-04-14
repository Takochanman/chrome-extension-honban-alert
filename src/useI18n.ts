import React from "react";

const useI18n = () => {
  return (key: string, placeholders?: string | string[]) => chrome.i18n.getMessage(key, placeholders)
};

export default useI18n;
