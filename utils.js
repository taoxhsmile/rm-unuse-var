function isValidDocumentLanguage(document) {
  return document.languageId.includes("javascript");
}

module.exports = {
  isValidDocumentLanguage,
};
