/**
 * Announcement Controller (public, authenticated)
 * Read-only access for any logged-in user, any role, any tenant.
 */
const announcementService = require('../services/announcementService');
const { asyncHandler, formatResponse } = require('../utils/helpers');

class AnnouncementController {
  /**
   * GET /v1/announcements/active
   */
  getActive = asyncHandler(async (req, res) => {
    const result = await announcementService.getActive();
    res.status(200).json(formatResponse(result));
  });
}

module.exports = new AnnouncementController();
