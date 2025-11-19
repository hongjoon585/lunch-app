import mongoose from 'mongoose';

// 식당 스키마
const restaurantSchema = new mongoose.Schema({
  name: String,              // 식당 이름
  aiSummary: String,         // AI 요약
  rating: Number,            // 평점
  reviewCount: Number,       // 리뷰 수
  estimatedPrice: String,    // 예상 가격
  mapLink: String,          // 지도 링크
  detailLink: String        // 상세보기 링크 (플레이스)
}, { _id: false });

// 카페 스키마
const cafeSchema = new mongoose.Schema({
  name: String,              // 카페 이름
  aiAnalysis: String,        // AI 분석
  rating: Number,            // 평점
  estimatedPrice: String,    // 예상 가격
  mapLink: String,          // 지도 링크
  detailLink: String,       // 상세보기 링크 (플레이스)
  distanceFromRestaurant: String  // 식당에서의 거리
}, { _id: false });

const recSchema = new mongoose.Schema({
  searchId: { type: mongoose.Types.ObjectId, unique: true, index: true, required: true },
  summary: {
    weather: String,        // 현재 날씨
    pick_reason: String     // 사용자 선택 요약
  },
  restaurant: restaurantSchema,  // 식당 정보 (하나)
  cafe: cafeSchema,             // 카페 정보 (하나)
  raw: mongoose.Schema.Types.Mixed  // 원본 API 응답
}, { timestamps: true });

export default mongoose.model('Recommendation', recSchema);

