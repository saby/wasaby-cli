const CMD = require('./src/Utils/CMD');

const options = {};

process.argv.forEach((arg) => {
   if (arg.startsWith('--')) {
      let argName = arg.substr(2);
      const [name, value] = argName.split('=', 2);
      options[name] = value === undefined ? true : value;
   }
});

const cmd = new CMD();

const port = process.env.PORT || 777;

cmd.execute(`node cli.js --tasks=app --workDir=${options.applicationRoot} --port=${port}`);
