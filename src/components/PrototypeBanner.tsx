/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Shown on every page so a public copy of this prototype is never mistaken
 * for the official APAAR / Government of India portal.
 */
export const PrototypeBanner: React.FC = () => (
  <div
    role="note"
    className="w-full bg-amber-400 text-slate-950 text-[11px] sm:text-xs font-semibold px-4 py-1.5 flex items-center justify-center gap-2 text-center"
  >
    <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
    <span>
      Hackathon prototype for demonstration only. Not an official Government of India / APAAR website. Do not enter real
      Aadhaar, APAAR or personal data.
    </span>
  </div>
);
