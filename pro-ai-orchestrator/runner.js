import { execa } from 'execa';
import chalk from 'chalk';
import ora from 'ora';

export async function run(cmd, args = [], options = {}) {
  const { 
    label = 'Executing', 
    silent = false
  } = options;

  let spinner;
  if (!silent) {
    spinner = ora({
      text: chalk.blue(`${label}...`),
      color: 'blue'
    }).start();
  }

  try {
    const subprocess = execa(cmd, args, {
      all: true,
      env: { ...process.env, FORCE_COLOR: 'true' }
    });

    // If we want to show some progress in the spinner
    if (!silent && spinner) {
        subprocess.all.on('data', (data) => {
            const lastLine = data.toString().trim().split('\n').pop();
            if (lastLine && lastLine.length < 50) {
                spinner.text = chalk.blue(`${label}: `) + chalk.gray(lastLine);
            }
        });
    }

    const { all } = await subprocess;
    
    if (!silent && spinner) {
      spinner.succeed(chalk.green(`${label} completed.`));
    }
    
    return all;
  } catch (error) {
    if (!silent && spinner) {
      spinner.fail(chalk.red(`${label} failed.`));
    }
    throw error.all || error.message || error;
  }
}
