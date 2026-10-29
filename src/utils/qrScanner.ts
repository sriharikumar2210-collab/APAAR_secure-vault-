/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student } from '../types';
import { formatApaarId, validateApaarId } from './verificationEngine';

export interface ApaarQrPayload {
  apaarId: string;
  name?: string;
  pen?: string;
  dob?: string;
  institution?: string;
  verificationUrl?: string;
  format: 'URL' | 'JSON' | 'PLAIN_TEXT' | 'UDISE_COLON';
  rawPayload: string;
}

export interface ParseQrResult {
  success: boolean;
  data?: ApaarQrPayload;
  error?: string;
}

/**
 * Extracts and validates APAAR ID and student metadata from various QR code payloads.
 * Supports:
 * 1. Web URLs: https://apaar.education.gov.in/verify?id=299095832586 or apaar://verify?id=...
 * 2. Structured JSON: {"apaarId":"2990 9583 2586", "name":"Abinaya S", "pen":"20194817290"}
 * 3. Plaintext 12-digit number (with or without spaces)
 * 4. UDISE/DigiLocker colon formats: UDISE:299095832586:Abinaya S
 */
export function parseApaarQrPayload(rawInput: string): ParseQrResult {
  if (!rawInput || typeof rawInput !== 'string') {
    return { success: false, error: 'Empty or invalid QR code content' };
  }

  const trimmed = rawInput.trim();

  // 1. Check for JSON format
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      const possibleId = parsed.apaarId || parsed.apaar_id || parsed.id || parsed.apaarID;
      if (possibleId) {
        const validation = validateApaarId(String(possibleId));
        if (validation.isValid) {
          return {
            success: true,
            data: {
              apaarId: formatApaarId(String(possibleId)),
              name: parsed.name || parsed.studentName,
              pen: parsed.pen || parsed.permanentEducationNumber,
              dob: parsed.dob || parsed.dateOfBirth,
              institution: parsed.institution || parsed.currentInstitution,
              verificationUrl: parsed.verificationUrl || parsed.url,
              format: 'JSON',
              rawPayload: trimmed,
            },
          };
        }
      }
    } catch {
      // Continue to next checks if JSON parse fails
    }
  }

  // 2. Check for URL format (e.g., https://apaar.education.gov.in/verify?id=299095832586 or apaar://verify?id=299095832586)
  if (trimmed.includes('http://') || trimmed.includes('https://') || trimmed.startsWith('apaar://')) {
    try {
      // Handle custom scheme apaar:// by replacing with https:// for URL parser
      const normalizedUrl = trimmed.startsWith('apaar://')
        ? trimmed.replace('apaar://', 'https://apaar.education.gov.in/')
        : trimmed;

      const urlObj = new URL(normalizedUrl);
      const idParam =
        urlObj.searchParams.get('id') ||
        urlObj.searchParams.get('apaarId') ||
        urlObj.searchParams.get('apaar_id') ||
        urlObj.searchParams.get('apaar');

      if (idParam) {
        const validation = validateApaarId(idParam);
        if (validation.isValid) {
          return {
            success: true,
            data: {
              apaarId: formatApaarId(idParam),
              name: urlObj.searchParams.get('name') || undefined,
              pen: urlObj.searchParams.get('pen') || undefined,
              verificationUrl: trimmed,
              format: 'URL',
              rawPayload: trimmed,
            },
          };
        }
      }

      // Check URL pathname (e.g., /verify/299095832586)
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);
      for (const segment of pathSegments) {
        const cleanDigits = segment.replace(/\D/g, '');
        if (cleanDigits.length === 12) {
          return {
            success: true,
            data: {
              apaarId: formatApaarId(cleanDigits),
              verificationUrl: trimmed,
              format: 'URL',
              rawPayload: trimmed,
            },
          };
        }
      }
    } catch {
      // Continue to fallback
    }
  }

  // 3. Check for UDISE / DigiLocker colon / pipe delimited formats
  if (trimmed.includes(':') || trimmed.includes('|')) {
    const parts = trimmed.split(/[:|]/);
    for (const part of parts) {
      const cleanDigits = part.replace(/\D/g, '');
      if (cleanDigits.length === 12) {
        return {
          success: true,
          data: {
            apaarId: formatApaarId(cleanDigits),
            name: parts.length > 2 ? parts[2].trim() : undefined,
            format: 'UDISE_COLON',
            rawPayload: trimmed,
          },
        };
      }
    }
  }

  // 4. Check for Raw 12-digit plain text (with or without spaces)
  const numericOnly = trimmed.replace(/\D/g, '');
  if (numericOnly.length === 12) {
    return {
      success: true,
      data: {
        apaarId: formatApaarId(numericOnly),
        format: 'PLAIN_TEXT',
        rawPayload: trimmed,
      },
    };
  }

  return {
    success: false,
    error: `Invalid APAAR QR code format. Expected a 12-digit APAAR ID or official verification URI. Received: "${trimmed.slice(0, 30)}..."`,
  };
}

/**
 * Resolves a scanned QR payload against the loaded student registry
 */
export function resolveStudentFromQr(
  rawInput: string,
  students: Student[]
): {
  success: boolean;
  student?: Student;
  parsedPayload?: ApaarQrPayload;
  error?: string;
} {
  const parseResult = parseApaarQrPayload(rawInput);
  if (!parseResult.success || !parseResult.data) {
    return { success: false, error: parseResult.error || 'Failed to decode QR code' };
  }

  const cleanTargetApaar = parseResult.data.apaarId.replace(/\s+/g, '');
  const matchedStudent = students.find(
    s => s.apaarId.replace(/\s+/g, '') === cleanTargetApaar
  );

  if (!matchedStudent) {
    return {
      success: false,
      parsedPayload: parseResult.data,
      error: `Scanned APAAR ID (${parseResult.data.apaarId}) not found in active student registry.`,
    };
  }

  return {
    success: true,
    student: matchedStudent,
    parsedPayload: parseResult.data,
  };
}

/**
 * Generates an official APAAR QR payload URI for a student's physical card
 */
export function generateApaarQrPayload(student: Student): string {
  const cleanId = student.apaarId.replace(/\s+/g, '');
  return `https://apaar.education.gov.in/verify?id=${cleanId}&name=${encodeURIComponent(student.name)}&pen=${student.pen}&inst=${encodeURIComponent(student.currentInstitution)}`;
}
