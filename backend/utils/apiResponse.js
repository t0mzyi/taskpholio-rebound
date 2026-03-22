const success = (res, data = {}, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({ success: true, data, message });
};

const error = (res, message = 'An error occurred', statusCode = 500) => {
  return res.status(statusCode).json({ success: false, data: null, message });
};

module.exports = { success, error };
