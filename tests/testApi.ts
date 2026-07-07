import { ZentaoClient } from '../src/zentaoClient.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  try {
    const client = new ZentaoClient();
    
    console.log('Logging in to Zentao...');
    await client.login();
    console.log('Successfully logged in.');

    console.log('\n--- Fetching execution tasks (Execution ID: 2) ---');
    try {
      const tasks = await client.getExecutionTasks(2, 1, 5);
      console.log('Tasks result:', JSON.stringify(tasks, null, 2));
    } catch (e: any) {
      console.error('Error fetching tasks:', e.response?.data || e.message);
    }

    console.log('\n--- Fetching bug details (Bug ID: 2) ---');
    try {
      const bug = await client.getBugDetails(2);
      console.log('Bug details:', JSON.stringify(bug, null, 2));
    } catch (e: any) {
      console.error('Error fetching bug:', e.response?.data || e.message);
    }
  } catch (error: any) {
    console.error('Fatal Error:', error.message || error);
  }
}

main();
