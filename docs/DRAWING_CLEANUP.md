# 실습 도면 필기 정리 기록

사용자 요청: 회로선·기호·인쇄 문자를 유지하고 볼펜/연필 메모·화살표·동그라미·손으로 그린 상자를 제거.

- 적용 파일: `public/exercises/sequence/19.png`, `public/exercises/sequence/20.png`
- 편집 전 보관: `sources/exercises/annotated/19.png`, `sources/exercises/annotated/20.png` (사이트 정적 배포 폴더 밖)
- 검사한 다른 도면: 01~18·21~24. 해당 필기를 발견하지 않아 유지.
- 도구: 기본 제공 `image_gen` 이미지 편집. 원본을 입력으로 제공. CLI/API 대체 실행은 사용하지 않음.
- 검사: 부품 이름, 코일·램프, NO/NC 기호, 접점 원과 회로선, 위/아래 전원선 연결을 원본과 시각 대조. 20번의 기동 버튼에서 유지 가지 중간으로 가로선을 추가한 첫 결과는 폐기. 최종 결과는 아래쪽 NC 뒤에만 병렬 연결이 있는지 재확인.
- 생성 편집은 픽셀 보존 편집이 아니므로 글꼴·선 굵기·용지 질감은 달라질 수 있음. 원본에 인쇄된 오류를 수정하는 작업과 구분함.

## 19번 최종 편집 지시

```text
Edit target: the supplied scanned electrical relay ladder circuit drawing. Remove ONLY all handwritten pen/pencil notes, handwriting letters a/b/c, coil polarity scribbles, circles around parts, arrows and thin hand-drawn boxes/brackets. Preserve the original printed circuit EXACTLY: every black straight wire, connection, circle terminal, contact symbol, PB/R/L printed identifiers, coils, and red upper power rail and blue lower rail, original margins and geometry and aspect ratio. Do NOT correct, simplify, add, remove or reroute any printed circuit connection. No new annotations, no new text. Clean white paper in the removed-note regions. Keep composition/alignment identical, no crop, no artistic redesign. This is a precision restoration of a technical drawing, not a new circuit.
```

## 20번 최종 편집 지시

```text
Precise restoration of THIS specific scanned circuit, remove ONLY handwriting. Keep EVERY printed black wire and terminal at the same location. Remove all thin hand-drawn rectangular boxes, circles, handwritten Korean, A/B letters, polarity notes and arrows. IMPORTANT: The PB1 lower terminal wire goes vertically DOWN to the horizontal branch at the BOTTOM of the R2 NC contact, around 50% image height. There must be NO horizontal wire from PB1 to the midpoint BETWEEN the R1 NO and R2 NC contacts (around 33% height). Likewise on the PB2 branch, there must be NO horizontal wire to the point between its R2 NO and R1 NC. Preserve ONLY the lower horizontal bridges at around 50% height. The upper hand-drawn rectangular strokes must vanish completely. Keep all original printed labels PB4 PB1 R1 R2 PB2 R2 R1 R1 R2 and coil/lamp R1 R2 L1 L2, all open and closed contact symbols, red dashed bus top and blue bottom bus. Preserve original margin and geometry, no crop. Do not add any wire, contact, symbol, dot, label, branch or junction. Clean white background. Return a faithful clean technical drawing, not a redesigned circuit.
```
