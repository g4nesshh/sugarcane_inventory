export const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export const formatNumber = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 });

export const formatMonth = (key) => {
  const [year, month] = key.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
};

export const formatDate = (value) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export const formatDateTime = (value) =>
  new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const toSentenceCase = (value) => {
  const words = value.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};
