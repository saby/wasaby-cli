class Template {
   static column(list) {
      return `<div class="contents-column">
                ${list}
              </div>`;
   }

   static demoModuleBlock(moduleName, contents) {
      return `<div>
                <div class="header"><h1>${moduleName}</h1></div>
                <div class="contents">
                    ${Template.column(contents[0])}
                    ${Template.column(contents[1])}
                    ${Template.column(contents[2])}
                    ${Template.column(contents[3])}
                </div>
              </div>`;
   }

   static page(title, content) {
      return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        .header {
            display: flex;
            justify-content: center;
        }
        .contents h2{
            margin: 0 0.5em;
        }
        .contents {
            display: flex;
            justify-content: center;
            line-height: 1.5em;
        }
        .contents-block {
            margin: 1em 0.5em;
        }
        .contents-block-ul {
            list-style: none;
            padding: 0 1em;
        }
        .contents-group-header{
            font-weight: bold;
        }
        .contents-column {
            width: 25%;
        }
    </style>
    <title>${title}</title>
</head>
<body>
    ${content}
</body>
</html>
`;
   }
}

module.exports = Template;
