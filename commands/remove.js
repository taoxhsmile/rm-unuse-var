const vscode = require("vscode");
const t = require("@babel/types");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const { isValidDocumentLanguage } = require("../utils");

module.exports = function () {
  const { activeTextEditor } = vscode.window;
  if (!activeTextEditor) {
    return;
  }

  if (!isValidDocumentLanguage(activeTextEditor.document)) {
    return;
  }

  const code = activeTextEditor.document.getText();

  const ast = parser.parse(code, {
    sourceType: "module",
  });

  traverse(ast, {
    VariableDeclaration(path) {
      const { node } = path;
      const { declarations } = node;

      node.declarations = declarations.filter((declaration) => {
        const { id } = declaration;
        // scope.getBinding(name) 获取当前所有绑定
        // scope.getBinding(name).referenced 绑定是否被引用
        // scope.getBinding(name).constantViolations 获取当前所有绑定修改
        // scope.getBinding(name).referencePaths  获取当前所有绑定路径
        if (t.isObjectPattern(id)) {
          id.properties = id.properties.filter((property) => {
            const binding = path.scope.getBinding(property.key.name);
            return !!binding?.referenced;
          });
          return id.properties.length > 0;
        } else {
          const binding = path.scope.getBinding(id.name);
          return !!binding?.referenced;
        }
      });

      if (node.declarations.length === 0) {
        path.remove();
      }
    },
    ImportDeclaration(path) {
      const { node } = path;
      const { specifiers } = node;
      if (!specifiers.length) return;
      node.specifiers = specifiers.filter((specifier) => {
        const { local } = specifier;
        const binding = path.scope.getBinding(local.name);
        return !!binding?.referenced;
      });
      if (node.specifiers.length === 0) {
        path.remove();
      }
    },
    FunctionDeclaration(path) {
      const { node } = path;
      const { id } = node;
      const binding = path.scope.getBinding(id.name);
      if (!binding?.referenced) {
        path.remove();
      }
    },
  });

  activeTextEditor.edit((editBuilder) => {
    editBuilder.replace(
      new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(activeTextEditor.document.lineCount + 1, 0)
      ),
      generate(ast).code
    );
  });
};
