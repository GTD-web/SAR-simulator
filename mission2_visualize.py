import json
import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D

# 1. JSON 파일 읽어오기 (어제 다운로드한 파일명과 동일한지 확인하세요!)
file_name = 'SAR_CrossTrack_50x50_Sorted.json'
with open(file_name, 'r', encoding='utf-8') as f:
    data = json.load(f)

# 2. 2차원 배열 데이터 추출 (어제 우리가 만든 50x50 계층 구조 반영)
grid = data['terrain']['grid']

lons = []
lats = []
eles = []

# 2차원 배열을 파이썬이 그리기 좋게 변환합니다
for row in grid:
    row_lons = [point['longitude'] for point in row]
    row_lats = [point['latitude'] for point in row]
    row_eles = [point['elevation'] for point in row]
    
    lons.append(row_lons)
    lats.append(row_lats)
    eles.append(row_eles)

# numpy 배열로 변환 (2D/3D surface를 그리기 위한 필수 작업)
lons = np.array(lons)
lats = np.array(lats)
eles = np.array(eles)

# 3. 도화지 세팅 (2D와 3D를 가로로 나란히 배치)
fig = plt.figure(figsize=(16, 7))

# --- [2D 시각화 (왼쪽)] ---
ax1 = fig.add_subplot(121)
# pcolormesh를 이용해 고도에 따른 색상 맵(2D) 생성
c = ax1.pcolormesh(lons, lats, eles, cmap='terrain', shading='auto')
fig.colorbar(c, ax=ax1, label='Elevation (m)')
ax1.set_title('2D Terrain Map (50x50)', fontsize=14)
ax1.set_xlabel('Longitude')
ax1.set_ylabel('Latitude')

# --- [3D 시각화 (오른쪽)] ---
ax2 = fig.add_subplot(122, projection='3d')
# scatter(점) 대신 격자를 연결한 surface(표면)로 예쁘게 렌더링
surf = ax2.plot_surface(lons, lats, eles, cmap='terrain', edgecolor='none', alpha=0.9)
fig.colorbar(surf, ax=ax2, label='Elevation (m)', shrink=0.5, aspect=5)
ax2.set_title('3D Terrain Surface (50x50)', fontsize=14)
ax2.set_xlabel('Longitude')
ax2.set_ylabel('Latitude')
ax2.set_zlabel('Elevation (m)')

# 간격 조정 및 화면 출력
plt.tight_layout()
plt.show()