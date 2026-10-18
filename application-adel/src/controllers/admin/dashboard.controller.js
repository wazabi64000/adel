import { adminDashboard } from '../../services/stats.service.js';
import { asyncHandler } from '../../utils/http.js';

export const index = asyncHandler(async (req, res) => {
  const data = await adminDashboard();
  return res.render('admin/dashboard', {
    title: 'Tableau de bord',
    ...data,
  });
});
