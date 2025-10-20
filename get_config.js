const fs = require('fs');
const path = require('path');

function get_config(configPath = path.join(__dirname, 'config.json')) {
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const cfg = JSON.parse(raw);
    const name = cfg.haxball_name ?? null;
    const pyEnv = cfg.python_env_executable_path ?? null;
    return [name, pyEnv];
  } catch (err) {
    return [null, "python"];
  }
}

module.exports = getConfigTuple;