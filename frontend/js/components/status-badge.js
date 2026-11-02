// js/components/status-badge.js
// Maps request/response/urgency/availability statuses to styled badges

export const STATUS_STYLES = {
  open:              'bb-badge-blue',
  matching:          'bb-badge-yellow',
  awaiting_response: 'bb-badge-yellow',
  donor_accepted:    'bb-badge-green',
  fulfilled:         'bb-badge-green',
  cancelled:         'bb-badge-grey',
  expired:           'bb-badge-grey',
  pending:           'bb-badge-yellow',
  accepted:          'bb-badge-green',
  completed:         'bb-badge-green',
  rejected:          'bb-badge-grey',
  critical:          'bb-badge-red',
  high:              'bb-badge-red',
  medium:            'bb-badge-yellow',
  low:               'bb-badge-blue',
  available:         'bb-badge-green',
  unavailable:       'bb-badge-grey',
  busy:              'bb-badge-yellow',
  verified:          'bb-badge-green',
  pending_review:    'bb-badge-yellow',
  rejected_v:        'bb-badge-grey',
};

export const STATUS_LABELS = {
  open:              'Open',
  matching:          'Matching',
  awaiting_response: 'Awaiting Response',
  donor_accepted:    'Donor Accepted',
  fulfilled:         'Fulfilled',
  cancelled:         'Cancelled',
  expired:           'Expired',
  pending:           'Pending',
  accepted:          'Accepted',
  completed:         'Donation Completed',
  rejected:          'Rejected',
  critical:          'Critical',
  high:              'High',
  medium:            'Medium',
  low:               'Low',
  available:         'Available',
  unavailable:       'Unavailable',
  busy:              'Busy',
  verified:          'Verified',
  pending_review:    'Pending Review',
};

export function renderStatusBadge(status) {
  if (!status) return '<span class="bb-badge bb-badge-grey">—</span>';
  const key   = String(status).toLowerCase().replace(' ', '_');
  const cls   = STATUS_STYLES[key] || 'bb-badge-grey';
  const label = STATUS_LABELS[key] || status;
  return `<span class="bb-badge ${cls}">${label}</span>`;
}

export default renderStatusBadge;
