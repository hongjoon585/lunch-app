import mongoose from 'mongoose';

const searchSchema = new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, index: true, required: true },
  query: {
    location: String,      // 현재 위치
    mood: String,          // 지금 기분
    category: String,      // 음식 카테고리
    companions: String,    // 목적
    budget: Number,        // 예산
    atmosphere: String     // 분위기
  },
  status: { type: String, enum: ['pending','done','failed'], default: 'pending' }
}, { timestamps: true });

export default mongoose.model('Search', searchSchema);

