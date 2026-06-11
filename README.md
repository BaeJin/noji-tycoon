# Noji Land Builder Dashboard

게임형 토지 활용 현황판 MVP.

## 목표

- 실제 토지 개발/활용 진행상황을 게임처럼 공유
- Land level, zones, objects, actions, quests, players를 한 화면에서 확인
- 가족/친구/동료에게 진행상황과 필요한 도움을 쉽게 설명

## 현재 방식

Vite 기반 정적 웹앱입니다.

- `index.html`: 화면 shell
- `src/app.js`: 렌더링 로직
- `src/styles.css`: 게임 UI 스타일
- `public/data/project.json`: MVP 데이터
- 자체 square grid 좌표 계산
- SVG rect: 1m×1m 정사각형 맵 렌더링

## 배포 추천

초기 MVP는 GitHub + Vercel만으로 충분합니다.
Supabase는 다음 단계에서 붙이는 것을 권장합니다.

Supabase가 필요한 시점:

- 여러 사람이 직접 퀘스트 상태를 수정
- 로그인/권한 필요
- 오브젝트 예약/사용 기간 관리
- 코멘트, 사진 업로드, 활동 로그 필요

## 주의

공유용 웹에는 주민번호, 원본 등기 문서, 세금 상세, 가족 개인정보를 올리지 않습니다.
공개 가능한 요약 데이터만 `project.json`에 넣습니다.


## Map Editor

`/map-editor.html`에서 별도 편집기를 제공합니다.

- 1칸 = 1m×1m = 1㎡
- zone paint / erase
- 타일 중심점 기준 m 단위 거리 측정
- 지정된 타일 개수로 ㎡와 평수 자동 계산
- JSON export 지원
