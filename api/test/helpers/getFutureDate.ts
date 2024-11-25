export const getFutureDate = () => {
  const date = new Date();
  date.setMonth(date.getMonth() + 2);
  return date.toISOString().split("T")[0]; // YYYY-MM-DD format
};
