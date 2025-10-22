// import runFlow from "./flowRunner.js";
// import runFlow from "./flowRunnerWithEvidenceOnFly.js";
import runFlow from './flowRunnerWithErrorCatch.js';
import { jest } from '@jest/globals';

jest.mock('nodemailer', () => ({
  createTransport: () => ({
    sendMail: jest.fn().mockResolvedValue({}),
  }),
}));

// 2) Increase Jest’s timeout to 50 seconds
jest.setTimeout(150000);

describe('Generic Regression Flow', () => {
  it('should execute the entire flow graph end-to-end', async () => {
    await runFlow();
  });
});
