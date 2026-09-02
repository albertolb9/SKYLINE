import { mount } from 'svelte';
import App from './app/App.svelte';

const target = document.getElementById('app');

if (!target) {
  throw new Error('SKYLINE: #app root element not found');
}

mount(App, { target });
