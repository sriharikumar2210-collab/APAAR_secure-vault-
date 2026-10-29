/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationService } from './notificationService.ts';

test('notificationService correctly formats SMS and Email payload for verification request', () => {
  const alert = notificationService.dispatchVerificationAlert({
    requestId: 'BGV-9999',
    studentName: 'Abinaya S',
    studentApaarId: '2990 9583 2586',
    recipientPhone: '+91 90000 00002',
    recipientEmail: 'abinaya.attur@student.example.edu.in',
    employerName: 'Tata Consultancy Services',
    requestedCredentials: ['DEGREE', 'MARKSHEET'],
    purpose: 'Pre-Employment Background Verification',
  });

  assert.equal(alert.requestId, 'BGV-9999');
  assert.equal(alert.studentName, 'Abinaya S');
  assert.match(alert.smsMessage, /Tata Consultancy Services/);
  assert.match(alert.smsMessage, /DPDP Act 2023/);
  assert.match(alert.emailSubject, /Tata Consultancy Services/);
  assert.match(alert.emailHtml, /Section 6 of the Digital Personal Data Protection Act/);
});

test('notificationService subscription pattern broadcasts to listeners', () => {
  let receivedAlertId = '';
  const unsubscribe = notificationService.subscribe(alert => {
    receivedAlertId = alert.id;
  });

  const alert = notificationService.dispatchVerificationAlert({
    requestId: 'BGV-8888',
    studentName: 'Karthik M',
    studentApaarId: '8686 2578 1740',
    recipientPhone: '+91 90000 00051',
    recipientEmail: 'karthik.sample@student.example.edu.in',
    employerName: 'Zoho Corporation',
    requestedCredentials: ['DEGREE'],
    purpose: 'Campus Verification',
  });

  assert.equal(receivedAlertId, alert.id);
  unsubscribe();
});
