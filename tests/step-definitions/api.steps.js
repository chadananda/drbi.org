import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

When('I make a GET request to {string}', async function (path) {
  this.apiResponse = await this.page.request.get(`${this.baseURL}${path}`);
});

When('I make a POST request to {string} with sample content', async function (path) {
  this.apiResponse = await this.page.request.post(`${this.baseURL}${path}`, {
    data: { title: 'Test Post', body: 'This is test content for validation purposes with enough characters to pass minimum length requirements.' },
    headers: { 'Content-Type': 'application/json' }
  });
});

Then('the response status should be {int}', async function (status) {
  expect(this.apiResponse.status()).toBe(status);
});

Then('the response should be valid JSON', async function () {
  const body = await this.apiResponse.text();
  expect(() => JSON.parse(body)).not.toThrow();
});

Then('the response should contain environment info', async function () {
  const body = await this.apiResponse.json();
  expect(body).toHaveProperty('environment');
});

Then('the response should contain a valid field', async function () {
  const body = await this.apiResponse.json();
  expect(body).toHaveProperty('valid');
});
