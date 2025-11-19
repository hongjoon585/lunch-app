// OpenAI + Google Places API 통합: 실제 식당/카페 검색
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Open-Meteo에서 실제 날씨 정보 가져오기
async function getWeatherFromAPI(location) {
  try {
    // 1. 주소를 좌표로 변환 (geocoding) - OpenAI로 주소를 좌표로 변환
    const geoPrompt = `다음 한국 주소의 위도(latitude)와 경도(longitude)를 정확히 제공해주세요. 응답은 JSON 형식으로 {"lat": 숫자, "lon": 숫자}만 제공하세요.
주소: ${location}`;

    const geoResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: 'You provide latitude and longitude coordinates for Korean addresses in JSON format only.' },
          { role: 'user', content: geoPrompt }
        ],
        temperature: 0.3
      })
    });

    if (!geoResponse.ok) {
      throw new Error('Geocoding failed');
    }

    const geoData = await geoResponse.json();
    const geoContent = geoData.choices[0].message.content;
    console.log('[recommendService] Geo response:', geoContent);
    const geoMatch = geoContent.match(/\{[\s\S]*\}/);
    if (!geoMatch) {
      console.error('[recommendService] No JSON found in:', geoContent);
      throw new Error('Invalid geocoding response');
    }
    
    const { lat, lon } = JSON.parse(geoMatch[0]);

    // 2. Open-Meteo API로 실제 날씨 가져오기
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=Asia%2FSeoul`;
    const weatherResponse = await fetch(weatherUrl);
    
    if (!weatherResponse.ok) {
      throw new Error('Weather API failed');
    }

    const weatherData = await weatherResponse.json();
    const current = weatherData.current;
    const temp = current.temperature_2m;
    const code = current.weather_code;

    // Weather code를 한국어로 변환
    const weatherDesc = getWeatherDescription(code);
    
    return { weather: `${weatherDesc} ${temp}℃`, lat, lon };
  } catch (error) {
    console.error('[recommendService] Weather fetch error:', error);
    return { weather: '날씨 정보 불러오기 실패', lat: null, lon: null };
  }
}

// WMO Weather Code를 한국어로 변환
function getWeatherDescription(code) {
  const descriptions = {
    0: '맑음', 1: '대체로 맑음', 2: '약간 흐림', 3: '흐림',
    45: '안개', 48: '결빙성 안개',
    51: '약한 이슬비', 53: '보통 이슬비', 55: '강한 이슬비',
    56: '약한 찬 이슬비', 57: '강한 찬 이슬비',
    61: '약한 비', 63: '보통 비', 65: '강한 비',
    66: '약한 찬 비', 67: '강한 찬 비',
    71: '약한 눈', 73: '보통 눈', 75: '강한 눈',
    77: '눈알',
    80: '약한 소나기', 81: '보통 소나기', 82: '강한 소나기',
    85: '약한 눈 소나기', 86: '강한 눈 소나기',
    95: '천둥번개', 96: '우박 천둥번개', 99: '심한 우박 천둥번개'
  };
  return descriptions[code] || '알 수 없음';
}

// Google Places API로 실제 식당 검색
async function searchRestaurantWithGoogle(location, lat, lon, category, mood, companions, budget, atmosphere) {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY is not configured');
  }

  try {
    // 음식 카테고리 매핑
    const categoryMap = {
      '양식': 'restaurant italian western',
      '한식': 'korean restaurant',
      '일식': 'japanese restaurant sushi',
      '중식': 'chinese restaurant',
      '아시안': 'asian restaurant thai vietnamese'
    };
    const query = categoryMap[category] || 'restaurant';

    // 사용자 예산을 가격 레벨로 변환
    const userBudgetPrice = budget <= 10000 ? '₩' : budget <= 15000 ? '₩₩' : budget <= 20000 ? '₩₩₩' : '₩₩₩₩';
    console.log('[recommendService] budget:', budget, '→', userBudgetPrice);

    // Google Places Text Search
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(location)} ${query}&location=${lat},${lon}&radius=5000&key=${GOOGLE_MAPS_API_KEY}&language=ko`;
    
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      throw new Error('Google Places search failed');
    }

    const searchData = await searchResponse.json();
    
    if (!searchData.results || searchData.results.length === 0) {
      throw new Error('No restaurant found');
    }

    // 첫 번째 결과 가져오기 (평점 높은 순)
    const place = searchData.results[0];
    
    // Place Details로 상세 정보 가져오기
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,rating,user_ratings_total,formatted_address,geometry,place_id,price_level&key=${GOOGLE_MAPS_API_KEY}&language=ko`;
    
    const detailsResponse = await fetch(detailsUrl);
    if (!detailsResponse.ok) {
      throw new Error('Google Places details failed');
    }

    const detailsData = await detailsResponse.json();
    const details = detailsData.result;

    // 가격 레벨 매핑 (사용자 예산 기반, Google API 정보 있으면 우선)
    const priceLevels = { 0: '₩', 1: '₩₩', 2: '₩₩₩', 3: '₩₩₩₩', 4: '₩₩₩₩₩' };
    const priceRange = priceLevels[details.price_level] || userBudgetPrice;
    console.log('[recommendService] price_level:', details.price_level, 'priceRange:', priceRange);

    // AI 요약 생성 (OpenAI)
    const aiPrompt = `다음 식당 정보를 사용자의 요구사항에 맞게 간단히 요약해주세요.
식당명: ${details.name}
평점: ${details.rating}/5 (${details.user_ratings_total}개 리뷰)
가격대: ${priceRange}
위치: ${details.formatted_address}

사용자 요구사항:
- 기분: ${mood}
- 목적: ${companions}
- 분위기: ${atmosphere}

한국어로 2-3문장으로 간결하게 추천 이유를 설명해주세요:`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: 'You provide concise restaurant summaries in Korean.' },
          { role: 'user', content: aiPrompt }
        ],
        temperature: 0.7,
        max_tokens: 150
      })
    });

    const aiData = await aiResponse.json();
    const aiSummary = aiData.choices[0].message.content.trim();

    // 지도 링크 생성
    const mapLink = `https://www.google.com/maps/place/?q=place_id:${place.place_id}`;
    const detailLink = `https://www.google.com/maps/place/?q=place_id:${place.place_id}`;

    return {
      name: details.name,
      aiSummary,
      rating: details.rating,
      reviewCount: details.user_ratings_total,
      estimatedPrice: priceRange,
      mapLink,
      detailLink
    };
  } catch (error) {
    console.error('[recommendService] Google Places restaurant error:', error);
    throw error;
  }
}

// Google Places API로 실제 카페 검색
async function searchCafeWithGoogle(location, lat, lon, mood, companions, atmosphere, budget) {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY is not configured');
  }

  try {
    // 카페 가격은 일반적으로 저렴하므로 기본 ₩₩
    const cafePrice = '₩₩';

    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(location)} 카페&location=${lat},${lon}&radius=3000&key=${GOOGLE_MAPS_API_KEY}&language=ko`;
    
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      throw new Error('Google Places search failed');
    }

    const searchData = await searchResponse.json();
    
    if (!searchData.results || searchData.results.length === 0) {
      throw new Error('No cafe found');
    }

    const place = searchData.results[0];
    
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,rating,user_ratings_total,formatted_address,geometry,place_id,price_level&key=${GOOGLE_MAPS_API_KEY}&language=ko`;
    
    const detailsResponse = await fetch(detailsUrl);
    if (!detailsResponse.ok) {
      throw new Error('Google Places details failed');
    }

    const detailsData = await detailsResponse.json();
    const details = detailsData.result;

    const priceLevels = { 0: '₩', 1: '₩₩', 2: '₩₩₩', 3: '₩₩₩₩', 4: '₩₩₩₩₩' };
    const priceRange = priceLevels[details.price_level] || cafePrice;

    // AI 분석 생성
    const aiPrompt = `다음 카페 정보를 사용자의 요구사항에 맞게 간단히 분석해주세요.
카페명: ${details.name}
평점: ${details.rating}/5 (${details.user_ratings_total}개 리뷰)

사용자 요구사항:
- 기분: ${mood}
- 목적: ${companions}
- 분위기: ${atmosphere}

한국어로 2-3문장으로 간결하게 분석해주세요:`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: 'You provide concise cafe analysis in Korean.' },
          { role: 'user', content: aiPrompt }
        ],
        temperature: 0.7,
        max_tokens: 150
      })
    });

    const aiData = await aiResponse.json();
    const aiAnalysis = aiData.choices[0].message.content.trim();

    const mapLink = `https://www.google.com/maps/place/?q=place_id:${place.place_id}`;
    const detailLink = `https://www.google.com/maps/place/?q=place_id:${place.place_id}`;

    return {
      name: details.name,
      aiAnalysis,
      rating: details.rating,
      estimatedPrice: priceRange,
      mapLink,
      detailLink,
      distanceFromRestaurant: '도보 5분'
    };
  } catch (error) {
    console.error('[recommendService] Google Places cafe error:', error);
    throw error;
  }
}

// 메인 추천 함수
export async function realRecommend({ location, mood, category, companions, budget, atmosphere }) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY is not configured');
  }

  try {
    // 실제 날씨 정보 가져오기 (좌표 포함)
    const { weather, lat, lon } = await getWeatherFromAPI(location);
    
    if (!lat || !lon) {
      throw new Error('Failed to get location coordinates');
    }

    // 실제 식당과 카페 검색
    const restaurant = await searchRestaurantWithGoogle(location, lat, lon, category, mood, companions, budget, atmosphere);
    const cafe = await searchCafeWithGoogle(location, lat, lon, mood, companions, atmosphere, budget);

    // 사용자 선택 요약
    const pickReason = `현재 위치: ${location}, 기분: ${mood}, 카테고리: ${category}, 목적: ${companions}, 예산: ${budget}원, 분위기: ${atmosphere}`;

    return {
      summary: {
        weather,
        pick_reason: pickReason
      },
      restaurant,
      cafe
    };
  } catch (error) {
    console.error('[recommendService] Main error:', error);
    throw error;
  }
}
