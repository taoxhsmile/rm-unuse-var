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
        // const { b, c } = a;
        if (t.isObjectPattern(id)) {
          // path.scope.getBinding(name).referenced 判断变量是否被引用
          // 通过filter移除掉没有使用的变量
          id.properties = id.properties.filter((property) => {
            const binding = path.scope.getBinding(property.key.name);
            // referenced 变量是否被引用
            // constantViolations 变量被重新定义的地方
            const { referenced, constantViolations } = binding;
            if (!referenced && constantViolations.length > 0) {
              constantViolations.map((violationPath) => {
                violationPath.remove();
              });
            }

            return referenced;
          });
          // 如果对象中所有变量都没有被应用，则该对象整个移除
          return id.properties.length > 0;
        } else {
          // const a = 1;
          const binding = path.scope.getBinding(id.name);
          const { referenced, constantViolations } = binding;
          if (!referenced && constantViolations.length > 0) {
            constantViolations.map((violationPath) => {
              violationPath.remove();
            });
          }
          return referenced;
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
