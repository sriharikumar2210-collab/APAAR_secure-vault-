/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  validateCreateAccount,
  buildUserAccount,
  getDefaultDesignation,
  DEFAULT_USER_ACCOUNTS,
} from './authEngine';
import { CreateAccountInput } from '../types/auth';

describe('User Account Authentication & Management Engine', () => {
  it('validates correct account creation inputs successfully', () => {
    const validStudent: CreateAccountInput = {
      name: 'Praveen Kumar',
      email: 'praveen.k@psgtech.example.edu.in',
      role: 'STUDENT',
      organization: 'PSG College of Technology, Coimbatore',
      designation: 'B.E. Computer Science',
      phone: '+91 90000 10987',
      apaarId: '8841 9920 1145',
    };

    const result = validateCreateAccount(validStudent);
    assert.strictEqual(result.isValid, true);
    assert.deepStrictEqual(result.errors, {});
  });

  it('catches missing or invalid fields during account creation', () => {
    const invalidInput: Partial<CreateAccountInput> = {
      name: ' ',
      email: 'not-an-email',
      role: undefined,
      organization: '',
    };

    const result = validateCreateAccount(invalidInput);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.name, 'Expected error for empty name');
    assert.ok(result.errors.email, 'Expected error for invalid email');
    assert.ok(result.errors.role, 'Expected error for missing role');
    assert.ok(result.errors.organization, 'Expected error for empty organization');
  });

  it('builds a complete UserAccount with proper timestamps and role-based prefix', () => {
    const input: CreateAccountInput = {
      name: 'Meenakshi Sundaram',
      email: 'm.sundaram@infosys.example.com',
      role: 'EMPLOYER',
      organization: 'Infosys Limited',
      phone: '+91 90000 02610',
    };

    const user = buildUserAccount(input, DEFAULT_USER_ACCOUNTS);
    assert.ok(user.id.startsWith('user-emp-'), 'ID should start with role prefix');
    assert.strictEqual(user.name, 'Meenakshi Sundaram');
    assert.strictEqual(user.email, 'm.sundaram@infosys.example.com');
    assert.strictEqual(user.role, 'EMPLOYER');
    assert.strictEqual(user.organization, 'Infosys Limited');
    assert.strictEqual(user.designation, 'Talent Acquisition & BGV Lead');
    assert.ok(user.createdAt);
    assert.ok(user.avatarBg);
  });

  it('provides default designations for all supported roles', () => {
    assert.strictEqual(getDefaultDesignation('STUDENT'), 'Student Candidate');
    assert.strictEqual(getDefaultDesignation('EMPLOYER'), 'Talent Acquisition & BGV Lead');
    assert.strictEqual(getDefaultDesignation('INSTITUTION'), 'Academic Registrar & NAD Officer');
    assert.strictEqual(getDefaultDesignation('REGULATOR'), 'MoE Regulatory Compliance Auditor');
  });

  it('contains valid pre-seeded default accounts for all primary roles', () => {
    assert.strictEqual(DEFAULT_USER_ACCOUNTS.length, 4);
    const roles = DEFAULT_USER_ACCOUNTS.map(a => a.role);
    assert.ok(roles.includes('STUDENT'));
    assert.ok(roles.includes('EMPLOYER'));
    assert.ok(roles.includes('INSTITUTION'));
    assert.ok(roles.includes('REGULATOR'));
  });

  it('throws an error when trying to build an account with invalid details', () => {
    const badInput: CreateAccountInput = {
      name: '',
      email: 'invalid',
      role: 'STUDENT',
      organization: '',
    };

    assert.throws(() => {
      buildUserAccount(badInput);
    }, /Full name must be at least 2 characters/);
  });

  it('demo accounts carry no password and use example domains only', () => {
    for (const acc of DEFAULT_USER_ACCOUNTS) {
      assert.ok(!('password' in acc) && !('passwordPin' in acc), `${acc.email} must not carry a password`);
      assert.match(acc.email, /\.example\./, `${acc.email} should use an example domain`);
    }
  });

  it('refuses self-registration as REGULATOR', () => {
    const result = validateCreateAccount({
      name: 'Someone',
      email: 'someone@example.com',
      role: 'REGULATOR',
      organization: 'Anywhere',
    });
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.role);
  });

  it('requires a password of 8+ characters with a letter and a number when one is given', () => {
    const base: CreateAccountInput = {
      name: 'Asha',
      email: 'asha@example.com',
      role: 'EMPLOYER',
      organization: 'Sample Co',
    };
    assert.ok(validateCreateAccount({ ...base, passwordPin: '2026' }).errors.password);
    assert.ok(validateCreateAccount({ ...base, passwordPin: 'password' }).errors.password);
    assert.strictEqual(validateCreateAccount({ ...base, passwordPin: 'Passw0rd99' }).isValid, true);
  });
});
