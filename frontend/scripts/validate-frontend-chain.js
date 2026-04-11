// 模拟前端 pre-MVP 主链路验证
// 验证：manifest -> dates -> selectedDate -> loadAndParseByDate -> WorkPoint 数量

import http from 'http';

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse failed for ${url}: ${e.message}. Response starts with: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

async function validate() {
  console.log('=== P3: 前端主链路 CLI 验证 ===\n');
  
  // 1. 模拟 loadDateManifest
  console.log('--- 步骤 1: loadDateManifest() ---');
  const manifestUrl = 'http://localhost:5173/data/daily_meeting/index.json';
  console.log(`请求路径: ${manifestUrl}`);
  const manifest = await fetchJSON(manifestUrl);
  console.log(`dates 数量: ${manifest.dates.length}`);
  console.log(`availableDates 示例: [${manifest.dates.slice(0, 3).join(', ')}, ..., ${manifest.dates[manifest.dates.length - 1]}]`);
  
  // 2. 模拟 selectedDate 初始化（取最新日期）
  console.log('\n--- 步骤 2: selectedDate 初始化 ---');
  const selectedDate = manifest.dates[manifest.dates.length - 1];
  console.log(`selectedDate: ${selectedDate}`);
  
  // 3. 模拟 buildDataUrl
  console.log('\n--- 步骤 3: 构建数据 URL ---');
  const normalizedDate = selectedDate.replace(/-/g, '');
  const dataUrl = `http://localhost:5173/data/daily_meeting/meeting_${normalizedDate}_all.json`;
  console.log(`实际读取文件: meeting_${normalizedDate}_all.json`);
  console.log(`完整 URL: ${dataUrl}`);
  
  // 4. 模拟 loadAndParseByDate - 解析实际数据结构
  console.log('\n--- 步骤 4: loadAndParseByDate() ---');
  const meetingData = await fetchJSON(dataUrl);
  const rawData = Array.isArray(meetingData) 
    ? meetingData 
    : (meetingData.raw_data || meetingData.data || []);
  console.log(`解析出的记录数: ${rawData.length}`);
  
  // 5. 模拟数据清洗（过滤无效坐标）
  console.log('\n--- 步骤 5: 数据清洗 ---');
  const validRecords = rawData.filter(r => {
    const lng = parseFloat(r.toolBoxTalkLongitude || r.longitude || r.lng);
    const lat = parseFloat(r.toolBoxTalkLatitude || r.latitude || r.lat);
    return !isNaN(lng) && !isNaN(lat) && lng !== 0 && lat !== 0 &&
           lng >= 108 && lng <= 114 && lat >= 24 && lat <= 30;
  });
  console.log(`合法坐标记录数: ${validRecords.length}`);
  console.log(`过滤掉的记录数: ${rawData.length - validRecords.length}`);
  
  // 6. 模拟 stats 计算
  console.log('\n--- 步骤 6: stats 计算 ---');
  console.log(`stats 输入记录数 (validCoordinateRecords): ${validRecords.length}`);
  const totalPeople = validRecords.reduce((sum, r) => {
    const num = parseInt(r.currentConstrHeadcount || r.number || r.workerCount || 0);
    return sum + (isNaN(num) || num < 0 ? 0 : num);
  }, 0);
  console.log(`当前作业总人数: ${totalPeople}`);
  
  console.log('\n=== 验证结果汇总 ===');
  console.log(`[1] manifest 请求返回 JSON: 是`);
  console.log(`[2] dates 数量: ${manifest.dates.length}`);
  console.log(`[3] selectedDate: ${selectedDate}`);
  console.log(`[4] dataSource: local`);
  console.log(`[5] 实际读取文件: meeting_${normalizedDate}_all.json`);
  console.log(`[6] WorkPoint 解析数量: ${rawData.length}`);
  console.log(`[7] stats 输入记录数: ${validRecords.length}`);
  console.log(`[8] skeleton 失败隔离: 见 P4 验证`);
  
  // 最终判断
  const allPass = manifest.dates.length > 0 
    && selectedDate 
    && rawData.length > 0 
    && validRecords.length > 0;
  console.log(`\n=== 最终判定 ===`);
  if (allPass) {
    console.log('✅ pre-MVP 主链路已恢复');
  } else {
    console.log('❌ pre-MVP 主链路未恢复');
    console.log(`   - dates > 0: ${manifest.dates.length > 0 ? '是' : '否'}`);
    console.log(`   - selectedDate 非空: ${selectedDate ? '是' : '否'}`);
    console.log(`   - rawData.length > 0: ${rawData.length > 0 ? '是' : '否'}`);
    console.log(`   - validRecords.length > 0: ${validRecords.length > 0 ? '是' : '否'}`);
  }
}

validate().catch(e => {
  console.error('\n=== 验证失败 ===');
  console.error(e.message);
  process.exit(1);
});
