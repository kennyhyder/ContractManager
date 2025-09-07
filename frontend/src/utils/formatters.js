import { format, parseISO, isValid } from 'date-fns';
import { CONTRACT_STATUS, CONTRACT_TYPES, USER_ROLES } from './constants';

// Status formatters
export const formatContractStatus = (status) => {
  const statusMap = {
    [CONTRACT_STATUS.DRAFT]: { label: 'Draft', color: 'gray' },
    [CONTRACT_STATUS.PENDING]: { label: 'Pending Approval', color: 'yellow' },
    [CONTRACT_STATUS.APPROVED]: { label: 'Approved', color: 'green' },
    [CONTRACT_STATUS.REJECTED]: { label: 'Rejected', color: 'red' },
    [CONTRACT_STATUS.SIGNED]: { label: 'Signed', color: 'blue' },
    [CONTRACT_STATUS.EXPIRED]: { label: 'Expired', color: 'orange' },
  };
  
  return statusMap[status] || { label: status, color: 'gray' };
};

export const formatContractType = (type) => {
  const typeMap = {
    [CONTRACT_TYPES.NDA]: 'Non-Disclosure Agreement',
    [CONTRACT_TYPES.SERVICE]: 'Service Agreement',
    [CONTRACT_TYPES.PURCHASE]: 'Purchase Agreement',
    [CONTRACT_TYPES.EMPLOYMENT]: 'Employment Contract',
    [CONTRACT_TYPES.LEASE]: 'Lease Agreement',
    [CONTRACT_TYPES.PARTNERSHIP]: 'Partnership Agreement',
    [CONTRACT_TYPES.OTHER]: 'Other',
  };
  
  return typeMap[type] || type;
};

export const formatUserRole = (role) => {
  const roleMap = {
    [USER_ROLES.USER]: 'User',
    [USER_ROLES.EDITOR]: 'Editor',
    [USER_ROLES.APPROVER]: 'Approver',
    [USER_ROLES.ADMIN]: 'Administrator',
  };
  
  return roleMap[role] || role;
};

// Name formatters
export const formatUserName = (user) => {
  if (!user) return 'Unknown User';
  
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  
  return user.name || user.email || 'Unknown User';
};

export const formatInitials = (name) => {
  if (!name) return '?';
  
  const parts = name.split(' ');
  
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  
  return name.substring(0, 2).toUpperCase();
};

// Date formatters
export const formatContractDates = (startDate, endDate) => {
  const start = startDate ? format(parseISO(startDate), 'MMM d, yyyy') : null;
  const end = endDate ? format(parseISO(endDate), 'MMM d, yyyy') : null;
  
  if (start && end) {
    return `${start} - ${end}`;
  } else if (start) {
    return `Starting ${start}`;
  } else if (end) {
    return `Until ${end}`;
  }
  
  return 'No date specified';
};

export const formatDuration = (startDate, endDate) => {
  if (!startDate || !endDate) return null;
  
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  
  if (!isValid(start) || !isValid(end)) return null;
  
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 30) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months !== 1 ? 's' : ''}`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${years} year${years !== 1 ? 's' : ''}`;
  }
};

// Value formatters
export const formatContractValue = (value, currency = 'USD') => {
  if (!value || typeof value !== 'number') return 'N/A';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatPercentage = (value, decimals = 1) => {
  if (typeof value !== 'number') return 'N/A';
  
  return `${value.toFixed(decimals)}%`;
};

export const formatMetricValue = (value, metric) => {
  if (value === null || value === undefined) return 'N/A';
  
  switch (metric) {
    case 'currency':
      return formatContractValue(value);
    case 'percentage':
      return formatPercentage(value);
    case 'duration':
      return `${value} days`;
    case 'count':
      return value.toLocaleString();
    default:
      return value;
  }
};

// List formatters
export const formatList = (items, maxItems = 3) => {
  if (!Array.isArray(items) || items.length === 0) return '';
  
  if (items.length <= maxItems) {
    return items.join(', ');
  }
  
  const displayed = items.slice(0, maxItems).join(', ');
  const remaining = items.length - maxItems;
  
  return `${displayed} +${remaining} more`;
};

export const formatTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  
  return tags.map(tag => ({
    label: tag.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: tag,
  }));
};

// Address formatter
export const formatAddress = (address) => {
  if (!address) return '';
  
  const parts = [
    address.street1,
    address.street2,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ].filter(Boolean);
  
  return parts.join(', ');
};

// Phone formatter
export const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');
  
  // Format as (XXX) XXX-XXXX for US numbers
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  // Format as +X XXX XXX XXXX for international
  if (cleaned.length > 10) {
    const countryCode = cleaned.slice(0, cleaned.length - 10);
    const number = cleaned.slice(-10);
    return `+${countryCode} ${number.slice(0, 3)} ${number.slice(3, 6)} ${number.slice(6)}`;
  }
  
  return phone;
};

// Error message formatter
export const formatErrorMessage = (error) => {
  if (typeof error === 'string') return error;
  
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
};

// Activity formatter
export const formatActivityMessage = (activity) => {
  const { type, user, target, metadata } = activity;
  const userName = formatUserName(user);
  
  switch (type) {
    case 'contract_created':
      return `${userName} created contract "${target.title}"`;
    case 'contract_updated':
      return `${userName} updated contract "${target.title}"`;
    case 'contract_approved':
      return `${userName} approved contract "${target.title}"`;
    case 'contract_rejected':
      return `${userName} rejected contract "${target.title}"`;
    case 'contract_signed':
      return `${userName} signed contract "${target.title}"`;
    case 'comment_added':
      return `${userName} commented on "${target.title}"`;
    case 'template_created':
      return `${userName} created template "${target.name}"`;
    case 'user_login':
      return `${userName} logged in`;
    default:
      return `${userName} performed ${type.replace(/_/g, ' ')}`;
  }
};

// Notification formatter
export const formatNotificationMessage = (notification) => {
  const { type, data } = notification;
  
  switch (type) {
    case 'contract_approval_required':
      return `Contract "${data.contractTitle}" requires your approval`;
    case 'contract_approved':
      return `Your contract "${data.contractTitle}" has been approved`;
    case 'contract_rejected':
      return `Your contract "${data.contractTitle}" has been rejected`;
    case 'contract_signed':
      return `Contract "${data.contractTitle}" has been signed by ${data.signerName}`;
    case 'contract_expiring':
      return `Contract "${data.contractTitle}" expires in ${data.daysUntilExpiry} days`;
    case 'comment_mention':
      return `${data.commenterName} mentioned you in a comment`;
    default:
      return notification.message || 'You have a new notification';
  }
};

// Search result formatter
export const formatSearchResult = (result) => {
  const { type, item, matches } = result;
  
  const title = type === 'contract' ? item.title : item.name;
  const subtitle = type === 'contract' 
    ? `${formatContractType(item.type)} • ${formatContractStatus(item.status).label}`
    : `${item.category} Template`;
  
  return {
    id: item._id,
    title,
    subtitle,
    type,
    icon: type === 'contract' ? '📄' : '📋',
    matches,
  };
};

// Export filename formatter
export const formatExportFilename = (prefix, format = 'pdf') => {
  const date = format(new Date(), 'yyyy-MM-dd');
  const timestamp = Date.now();
  
  return `${prefix}_${date}_${timestamp}.${format}`;
};

// Table column formatter
export const formatTableColumn = (value, type) => {
  switch (type) {
    case 'date':
      return value ? format(parseISO(value), 'MMM d, yyyy') : '-';
    case 'datetime':
      return value ? format(parseISO(value), 'MMM d, yyyy h:mm a') : '-';
    case 'currency':
      return formatContractValue(value);
    case 'status':
      return formatContractStatus(value).label;
    case 'boolean':
      return value ? '✓' : '✗';
    case 'list':
      return formatList(value);
    default:
      return value || '-';
  }
};