// End-to-end tests: a real browser uses the website the way people would.
import { expect, test } from '@playwright/test';
import { makePdf, TEST_PASSWORD } from '../server/tests/fixtures.js';

const NEW_STUDENT = { id: `E2E${Date.now().toString().slice(-6)}`, name: 'Playwright Student' };
const NEW_MENTOR = { id: `mentor${Date.now().toString().slice(-5)}`, name: 'Playwright Mentor' };
const pdf = (name) => ({ name, mimeType: 'application/pdf', buffer: makePdf(['Playwright test', name]) });

async function login(page, id, password = TEST_PASSWORD) {
  await page.goto('/login');
  await page.fill('#systemId', id);
  await page.fill('#password', password);
  await page.click('form button.button');
  await expect(page.locator('.sidebar')).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test('the home page explains the process with clickable steps', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('internship document');
  await page.getByRole('button', { name: /Review/ }).click();
  await expect(page.locator('.mock-card .status')).toHaveText(/Pending/);
});

test('a student can register with a batch and sees a live countdown', async ({ page }) => {
  await page.goto('/register');
  await page.fill('#systemId', NEW_STUDENT.id);
  await page.fill('#name', NEW_STUDENT.name);
  const batchValue = await page.locator('#batch option', { hasText: 'B.Tech CSE 2026' }).getAttribute('value');
  await page.selectOption('#batch', batchValue);
  await page.fill('#password', 'Short1');
  await expect(page.locator('.strength')).toContainText(/Too short|Weak/);
  await page.fill('#password', TEST_PASSWORD);
  await page.click('form button.button');
  await expect(page.locator('.notice.success')).toContainText('Account created');
  await login(page, NEW_STUDENT.id);
  await expect(page.locator('.next')).toContainText('Upload your Final Project Report');
  const seconds = page.locator('.countdown-part strong').last();
  const before = await seconds.textContent();
  await expect(seconds).not.toHaveText(before, { timeout: 3000 });
});

test('the coordinator adds a mentor and assigns the new student', async ({ page }) => {
  await login(page, 'coordinator');
  await expect(page.locator('.tile').first()).toContainText('Students');
  await page.goto('/admin/users');
  await page.selectOption('#new-role', 'mentor');
  await page.fill('#new-id', NEW_MENTOR.id);
  await page.fill('#new-name', NEW_MENTOR.name);
  await page.fill('#new-password', TEST_PASSWORD);
  await page.getByRole('button', { name: 'Add user' }).click();
  await expect(page.locator('.toast')).toContainText(`${NEW_MENTOR.name} was added as mentor`);
  await page.getByLabel(`Mentor of ${NEW_STUDENT.name}`).selectOption({ label: NEW_MENTOR.name });
  await expect(page.locator('.toast').last()).toContainText(`${NEW_STUDENT.name} was updated`);
});

test('uploads and decisions reach the other person instantly', async ({ browser }) => {
  const studentPage = await (await browser.newContext()).newPage();
  const mentorPage = await (await browser.newContext()).newPage();
  await login(studentPage, NEW_STUDENT.id);
  await login(mentorPage, NEW_MENTOR.id);
  await expect(mentorPage.locator('.live.on')).toBeVisible();
  await expect(studentPage.locator('.live.on')).toBeVisible();

  // The browser refuses a file that is not a PDF.
  const reportCard = studentPage.locator('.doc-card', { hasText: 'Final Project Report' });
  await reportCard.locator('input[type=file]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(studentPage.locator('.toast.error')).toContainText('Only PDF');

  await reportCard.locator('input[type=file]').setInputFiles(pdf('final_report.pdf'));
  await reportCard.getByRole('button', { name: 'Upload' }).click();
  await expect(studentPage.locator('.toast').last()).toContainText('Final Project Report uploaded');

  // The mentor is told without refreshing.
  await expect(mentorPage.locator('.toast').last()).toContainText(`${NEW_STUDENT.name} uploaded the Final Project Report`);
  await expect(mentorPage.locator('.bell .badge')).toHaveText('1');

  await mentorPage.locator('a.person', { hasText: NEW_STUDENT.name }).click();
  await expect(mentorPage.locator('iframe')).toBeVisible();
  await mentorPage.getByRole('button', { name: 'Reject' }).click();
  await expect(mentorPage.locator('.toast.error').last()).toContainText('explaining the rejection');
  await mentorPage.getByRole('button', { name: 'Signature is missing' }).click();
  await mentorPage.getByRole('button', { name: 'Reject' }).click();

  // The student sees the decision without refreshing.
  await expect(studentPage.locator('.toast.error').last()).toContainText('Final Project Report was rejected');
  await expect(studentPage.locator('.next')).toContainText('Fix your Final Project Report');
});

test('students and mentors can talk about a document and see every version', async ({ page }) => {
  await login(page, NEW_STUDENT.id);
  await page.goto('/documents/report');
  await expect(page.locator('.bubble')).toContainText('Signature is missing');
  await page.fill('textarea[aria-label="Message"]', 'Signed version coming now.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('.bubble.mine')).toContainText('Signed version coming now.');
  await page.locator('.side-stack input[type=file]').setInputFiles(pdf('final_report_signed.pdf'));
  await page.getByRole('button', { name: 'Upload new version' }).click();
  await expect(page.locator('.versions li')).toHaveCount(2);
  await expect(page.locator('.versions li.active')).toContainText('v2');
});

test('a plagiarism report needs a similarity below 10% to be approved', async ({ page }) => {
  await login(page, 'mentor.rao');
  await page.locator('a.person', { hasText: 'Kabir' }).click();
  await page.locator('.tab', { hasText: 'Plagiarism' }).click();
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.locator('.toast.error').last()).toContainText('similarity percentage');
  await page.fill('#similarity', '12');
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.locator('.toast.error').last()).toContainText('below 10%');
  await page.fill('#similarity', '6');
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.locator('.toast').last()).toContainText('Approved');
});

test('the coordinator can export a CSV and see the audit log', async ({ page }) => {
  await login(page, 'coordinator');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Export CSV' }).click()]);
  const csv = await (await download.createReadStream()).toArray();
  expect(Buffer.concat(csv).toString()).toContain(NEW_STUDENT.id);
  await page.goto('/admin/audit');
  await expect(page.locator('table')).toContainText('Rejected document');
  await expect(page.locator('table')).toContainText('Exported CSV');
});

test('a deactivated account cannot log in', async ({ page }) => {
  await login(page, 'coordinator');
  await page.goto('/admin/users');
  await page.locator('tr', { hasText: 'Test Student Vihaan' }).locator('.switch').click();
  await expect(page.locator('.toast').last()).toContainText('was updated');
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.goto('/login');
  await page.fill('#systemId', '2023001007');
  await page.fill('#password', TEST_PASSWORD);
  await page.click('form button.button');
  await expect(page.locator('.notice.error')).toContainText('deactivated');
});

test('dark mode is remembered and the student page fits a phone screen', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await login(page, '2023001001');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflows).toBe(false);
});
