import { ZentaoClient } from '../src/zentaoClient.js';
import * as dotenv from 'dotenv';
import { cleanTask, cleanBug, taskToMarkdown, bugToMarkdown } from '../src/tools.js';

dotenv.config();

async function main() {
  try {
    const client = new ZentaoClient();
    
    console.log('Logging in to Zentao...');
    await client.login();
    console.log('Successfully logged in.');

    console.log('\n--- Fetching task details (Task ID: 3826) ---');
    try {
      const task = await client.getTaskDetails(3826);
      console.log('Original desc:', JSON.stringify(task.desc));
      console.log('\nFormatted Task Markdown:');
      console.log(taskToMarkdown(cleanTask(task)));
    } catch (e: any) {
      console.error('Error fetching task:', e.response?.data || e.message);
    }

    console.log('\n--- Fetching bug details (Bug ID: 3722) ---');
    try {
      const bug = await client.getBugDetails(3722);
      console.log('Original steps:', JSON.stringify(bug.steps));
      console.log('\nFormatted Bug Markdown:');
      console.log(bugToMarkdown(cleanBug(bug)));
    } catch (e: any) {
      console.error('Error fetching bug:', e.response?.data || e.message);
    }
  } catch (error: any) {
    console.error('Fatal Error:', error.message || error);
  }
}

main();

