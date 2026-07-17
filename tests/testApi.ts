import { ZentaoClient } from '../src/zentaoClient.js';
import * as dotenv from 'dotenv';
import { taskToMarkdown, bugToMarkdown } from '../src/tools.js';
import { renderHistoryAndComments } from '../src/formatters/actionFormatter.js';
import {
  myWorkToMarkdown,
  myTasksToMarkdown,
  myBugsToMarkdown,
} from '../src/formatters/myWorkFormatter.js';

dotenv.config();

async function main() {
  try {
    const client = new ZentaoClient();
    
    console.log('Logging in to Zentao...');
    await client.login();
    console.log('Successfully logged in.');

    console.log('\n--- Fetching my work items (Assigned to Me) ---');
    try {
      const myWork = await client.getMyWork();
      console.log('\nFormatted My Work Markdown:');
      console.log(myWorkToMarkdown(myWork, client));
    } catch (e: any) {
      console.error('Error fetching my work:', e.response?.data || e.message);
    }

    console.log('\n--- Fetching my tasks only ---');
    try {
      const myTasks = await client.getMyTasks();
      console.log('\nFormatted My Tasks Markdown:');
      console.log(myTasksToMarkdown(myTasks, client));
    } catch (e: any) {
      console.error('Error fetching my tasks:', e.response?.data || e.message);
    }

    console.log('\n--- Fetching my bugs only ---');
    try {
      const myBugs = await client.getMyBugs();
      console.log('\nFormatted My Bugs Markdown:');
      console.log(myBugsToMarkdown(myBugs, client));
    } catch (e: any) {
      console.error('Error fetching my bugs:', e.response?.data || e.message);
    }

    console.log('\n--- Fetching task details (Task ID: 3826) ---');
    try {
      const task = await client.getTaskDetails(3826);
      console.log('\nFormatted Task Markdown:');
      console.log(await taskToMarkdown(task));
    } catch (e: any) {
      console.error('Error fetching task:', e.response?.data || e.message);
    }

    console.log('\n--- Fetching bug details (Bug ID: 3722) ---');
    try {
      const bug = await client.getBugDetails(3722);
      console.log('\nFormatted Bug Markdown:');
      console.log(await bugToMarkdown(bug));
    } catch (e: any) {
      console.error('Error fetching bug:', e.response?.data || e.message);
    }

    console.log('\n--- Fetching bug details with inline image (Bug ID: 1668) ---');
    try {
      const bug = await client.getBugDetails(1668);
      console.log('\nFormatted Bug Markdown (with localized images):');
      console.log(await bugToMarkdown(bug));
    } catch (e: any) {
      console.error('Error fetching bug:', e.response?.data || e.message);
    }

    console.log('\n--- Fetching task comments only (Task ID: 3826) ---');
    try {
      const task = await client.getTaskDetails(3826);
      const comments = await renderHistoryAndComments(task.actions, client);
      console.log('\nFormatted Task Comments Markdown:');
      console.log(comments.trim() || '*No comments found.*');
    } catch (e: any) {
      console.error('Error fetching task comments:', e.response?.data || e.message);
    }

    console.log('\n--- Fetching bug comments only (Bug ID: 3722) ---');
    try {
      const bug = await client.getBugDetails(3722);
      const comments = await renderHistoryAndComments(bug.actions, client);
      console.log('\nFormatted Bug Comments Markdown:');
      console.log(comments.trim() || '*No comments found.*');
    } catch (e: any) {
      console.error('Error fetching bug comments:', e.response?.data || e.message);
    }
  } catch (error: any) {
    console.error('Fatal Error:', error.message || error);
  }
}

main();

