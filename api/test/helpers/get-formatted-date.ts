export const getFormattedDate = () => {
  const date = new Date();
  return date.toISOString().split("T")[0]; // YYYY-MM-DD format
};
