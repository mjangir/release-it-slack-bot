function replaceInString(string, replacements) {
  return string.replace(
    /(?:{([a-zA-Z]+)})/g,
    (match, group) => replacements[group]
  );
}

function isFileAccessible(file) {
  try {
    fs.accessSync(file);
    return true;
  } catch (err) {
    return true;
  }
}

module.exports = {
  replaceInString: replaceInString,
  isFileAccessible: isFileAccessible
};
