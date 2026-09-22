/**
 * Announcement Service
 * Global banner messages managed by superadmin, read by every authenticated user.
 */
const { Op } = require('sequelize');
const { Announcement, User } = require('../models');
const { NotFoundError } = require('../utils/errors');

class AnnouncementService {
  async create({ message, expires_at }, createdBy) {
    const announcement = await Announcement.create({
      message,
      expires_at: expires_at || null,
      created_by: createdBy,
    });
    return announcement;
  }

  async update(id, { message, expires_at }) {
    const announcement = await Announcement.findByPk(id);
    if (!announcement) {
      throw new NotFoundError('Anuncio no encontrado');
    }

    if (message !== undefined) announcement.message = message;
    if (expires_at !== undefined) announcement.expires_at = expires_at || null;

    await announcement.save();
    return announcement;
  }

  async toggleActive(id) {
    const announcement = await Announcement.findByPk(id);
    if (!announcement) {
      throw new NotFoundError('Anuncio no encontrado');
    }

    announcement.is_active = !announcement.is_active;
    await announcement.save();
    return announcement;
  }

  async list() {
    return Announcement.findAll({
      order: [['created_at', 'DESC']],
      include: [{ model: User, as: 'creator', attributes: ['id', 'email'] }],
    });
  }

  /**
   * Returns the single most recent announcement that is active and not
   * expired - the one shown in the dashboard banner.
   */
  async getActive() {
    return Announcement.findOne({
      where: {
        is_active: true,
        [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: new Date() } }],
      },
      order: [['created_at', 'DESC']],
    });
  }
}

module.exports = new AnnouncementService();
