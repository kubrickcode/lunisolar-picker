import type { NextConfig } from 'next';

// Goal: 정적 내보내기로 서버 렌더 HTML을 파일로 남겨 마크업·hydration을 서버 없이 검사함
const nextConfig: NextConfig = {
  output: 'export',
};

export default nextConfig;
