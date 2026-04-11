import { RISK_COLORS } from '@/constants/layers';
import { useAppStore } from '@/store';
import type { RiskLevel, WorkStatus } from '@/types';

const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  working: '作业中',
  paused: '作业暂停',
  finished: '当日作业完工',
  unknown: '未知状态',
};

// 展示口径：底层数据中的 unknown 在 UI 上统一显示为"无风险"
const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  0: '无风险',
  1: '一级风险',
  2: '二级风险',
  3: '三级风险',
  4: '四级风险',
  unknown: '无风险',
};

// M1R2: 统一详情对象类型（已移除 line）
type DetailObject = 
  | { type: 'workPoint'; data: any }
  | { type: 'tower'; data: any }
  | { type: 'station'; data: any }
  | null;

export function DetailPanel() {
  const { selectedItem, clearSelectedItem, selectedObject, clearSelectedObject } = useAppStore();
  
  // 统一关闭处理
  const handleClose = () => {
    clearSelectedItem();
    clearSelectedObject?.();
  };
  
  // 判断显示内容
  const displayObject: DetailObject = selectedObject || (selectedItem ? { type: 'workPoint', data: selectedItem } : null);
  
  if (!displayObject) {
    return (
      <div className="panel p-4 h-full flex flex-col">
        <h2 className="panel-title">详情信息</h2>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <p className="text-sm text-gray-500">点击地图上的对象查看详情</p>
          </div>
        </div>
      </div>
    );
  }
  
  const { type, data } = displayObject;
  
  return (
    <div className="panel p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="panel-title mb-0">详情信息</h2>
        <button onClick={handleClose} className="text-xs text-gray-400 hover:text-gray-600">关闭</button>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-3">
        {/* 对象类型标识 */}
        <div className="bg-blue-50 rounded p-2">
          <span className="text-xs text-blue-600 font-medium">
            {type === 'tower' && '杆塔'}
            {type === 'station' && '变电站'}
            {type === 'workPoint' && '作业点'}
          </span>
        </div>
        
        {/* 根据类型显示不同字段 */}
        {type === 'tower' && (
          <>
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">杆塔编号</div>
              <div className="text-sm font-medium">{data.tower_no || data.towerNo}</div>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">所属线路</div>
              <div className="text-sm">{data.single_project_code || data.singleProjectCode}</div>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">坐标</div>
              <div className="text-sm">{data.longitude}, {data.latitude}</div>
            </div>
          </>
        )}
        
        {type === 'station' && (
          <>
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">变电站名称</div>
              <div className="text-sm font-medium">{data.name || data.single_project_code}</div>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">项目编码</div>
              <div className="text-sm">{data.prj_code || data.prjCode}</div>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">坐标</div>
              <div className="text-sm">{data.longitude}, {data.latitude}</div>
            </div>
          </>
        )}
        
        {type === 'workPoint' && (
          <>
            {/* 工程信息 */}
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">工程名称</div>
              <div className="text-sm font-medium">{data.projectName}</div>
            </div>
            
            {/* 风险等级 */}
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">风险等级</div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: RISK_COLORS[data.riskLevel as RiskLevel] }} />
                <span className="text-sm">{RISK_LEVEL_LABELS[data.riskLevel as RiskLevel]}</span>
              </div>
            </div>
            
            {/* 作业人数 */}
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">作业人数</div>
              <div className="text-sm">{data.personCountDisplay ?? data.personCount ?? 0} 人</div>
            </div>
            
            {/* 作业状态 */}
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">作业状态</div>
              <div className="text-sm">{WORK_STATUS_LABELS[data.workStatus as WorkStatus]}</div>
            </div>
            
            {/* 电压等级 */}
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">电压等级</div>
              <div className="text-sm">{data.voltageLevelName ?? data.voltageLevel ?? '--'}</div>
            </div>
            
            {/* 市州 */}
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">市州</div>
              <div className="text-sm">{data.city}</div>
            </div>
            
            {/* 地址 */}
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">作业地点</div>
              <div className="text-sm">{data.address}</div>
            </div>
            
            {/* 施工单位 */}
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">施工单位</div>
              <div className="text-sm">{data.constructionUnit}</div>
            </div>
            
            {/* 监理单位 */}
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">监理单位</div>
              <div className="text-sm">{data.supervisionUnit}</div>
            </div>
            
            {/* 工作负责人 */}
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">工作负责人</div>
              <div className="text-sm">{data.leaderName}</div>
            </div>
            
            {/* 作业内容 */}
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">作业内容</div>
              <div className="text-sm">{data.workProcedure}</div>
            </div>
            
            {/* 作业票信息 */}
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">作业票号</div>
              <div className="text-sm font-mono">{data.ticketNo}</div>
            </div>
            
            {/* 作业日期 */}
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">作业日期</div>
              <div className="text-sm">{data.workDate} {data.workStartTime}</div>
            </div>
            
            {/* M1 Round2: unresolved 状态提示 */}
            <div className={data.singleProjectCode ? 'bg-green-50 rounded p-3' : 'bg-yellow-50 rounded p-3'}>
              <div className={`text-xs mb-1 ${data.singleProjectCode ? 'text-green-600' : 'text-yellow-600'}`}>项目编码</div>
              <div className="text-sm font-mono">{data.singleProjectCode ?? data.projectCode ?? 'N/A'}</div>
              <div className={`text-xs mt-1 ${data.singleProjectCode ? 'text-green-500' : 'text-yellow-500'}`}>
                {data.singleProjectCode ? '已解析' : '未解析 (unresolved)'}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
