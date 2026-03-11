/**
 * Signal 시각화 패널
 * SAR Signal (Chirp) 및 Echo Signal 시각화
 */

import { Complex64Array, SignalStatistics } from '../types/signal.types.js';
import { SignalDataProcessor } from '../utils/signal-data-processor.js';

/**
 * Signal 시각화 옵션
 */
export interface SignalVisualizationOptions {
  showReal?: boolean;
  showImag?: boolean;
  showMagnitude?: boolean;
  showPhase?: boolean;
  normalize?: boolean;
  logScale?: boolean;
}

export class SignalVisualizationPanel {
  private sidebar: HTMLElement;
  private chirpCanvas: HTMLCanvasElement | null;
  private echoCanvas: HTMLCanvasElement | null;
  private detailedChirpCanvas: HTMLCanvasElement | null;
  private chirpStatisticsDiv: HTMLElement | null;
  private echoStatisticsDiv: HTMLElement | null;
  private modal: HTMLElement | null;
  private modalCanvas: HTMLCanvasElement | null;
  private modalTitle: HTMLElement | null;
  private modalCloseBtn: HTMLButtonElement | null;
  private currentChirpData: Complex64Array | null = null;
  private currentEchoData: Complex64Array | null = null;
  private currentConfig: any = null;

  constructor() {
    this.sidebar = document.getElementById('signalResultsSidebar') as HTMLElement;
    if (!this.sidebar) {
      throw new Error('Signal 결과 사이드바를 찾을 수 없습니다.');
    }

    this.chirpCanvas = document.getElementById('chirpSignalCanvas') as HTMLCanvasElement;
    this.echoCanvas = document.getElementById('echoSignalCanvas') as HTMLCanvasElement;
    this.detailedChirpCanvas = document.getElementById('detailedChirpCanvas') as HTMLCanvasElement;
    this.chirpStatisticsDiv = document.getElementById('chirpStatistics') as HTMLElement;
    this.echoStatisticsDiv = document.getElementById('echoStatistics') as HTMLElement;

    // 모달 요소
    this.modal = document.getElementById('canvasModal') as HTMLElement;
    this.modalCanvas = document.getElementById('canvasModalCanvas') as HTMLCanvasElement;
    this.modalTitle = document.getElementById('canvasModalTitle') as HTMLElement;
    this.modalCloseBtn = document.getElementById('canvasModalClose') as HTMLButtonElement;

    // 닫기 버튼 이벤트 설정
    this.setupCloseButton();
    
    // Canvas 클릭 이벤트 설정
    this.setupCanvasClickHandlers();
  }

  /**
   * 닫기 버튼 설정
   */
  private setupCloseButton(): void {
    const closeBtn = document.getElementById('signalResultsCloseBtn') as HTMLButtonElement;
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.hide();
      });
    }
    
    // 모달 닫기 버튼
    if (this.modalCloseBtn) {
      this.modalCloseBtn.addEventListener('click', () => {
        this.closeModal();
      });
    }
    
    // 모달 배경 클릭 시 닫기
    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.closeModal();
        }
      });
    }
    
    // ESC 키로 모달 닫기
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal && this.modal.style.display !== 'none') {
        this.closeModal();
      }
    });
  }

  /**
   * Canvas 클릭 이벤트 설정
   */
  private setupCanvasClickHandlers(): void {
    if (this.chirpCanvas) {
      this.chirpCanvas.style.cursor = 'pointer';
      this.chirpCanvas.addEventListener('click', () => {
        this.openModal('Chirp Signal', 'chirp');
      });
    }
    
    if (this.echoCanvas) {
      this.echoCanvas.style.cursor = 'pointer';
      this.echoCanvas.addEventListener('click', () => {
        this.openModal('Echo Signal', 'echo');
      });
    }

    if (this.detailedChirpCanvas) {
      this.detailedChirpCanvas.style.cursor = 'pointer';
      this.detailedChirpCanvas.addEventListener('click', () => {
        this.openModal('상세 Chirp Signal - Time Domain (With Carrier Frequency)', 'detailedChirp');
      });
    }
  }

  /**
   * 모달 열기
   */
  private openModal(title: string, signalType: 'chirp' | 'echo' | 'detailedChirp'): void {
    if (!this.modal || !this.modalCanvas || !this.modalTitle) return;
    
    this.modalTitle.textContent = title;
    this.modal.style.display = 'flex';
    
    // 모달 Canvas 크기 설정 (더 크게)
    const modalWidth = Math.min(window.innerWidth * 0.9, 1200);
    const modalHeight = Math.min(window.innerHeight * 0.8, 800);
    this.modalCanvas.width = modalWidth;
    this.modalCanvas.height = modalHeight;
    
    // 신호 다시 그리기
    if (signalType === 'chirp' && this.currentChirpData && this.currentConfig) {
      this.drawSignalOnModal(this.modalCanvas, this.currentChirpData, this.currentConfig, signalType);
    } else if (signalType === 'echo' && this.currentEchoData && this.currentConfig) {
      this.drawSignalOnModal(this.modalCanvas, this.currentEchoData, this.currentConfig, signalType);
    } else if (signalType === 'detailedChirp' && this.currentChirpData && this.currentConfig) {
      this.drawDetailedChirpOnModal(this.modalCanvas, this.currentChirpData, this.currentConfig);
    }
  }

  /**
   * 모달 닫기
   */
  private closeModal(): void {
    if (this.modal) {
      this.modal.style.display = 'none';
    }
  }

  /**
   * 모달 Canvas에 신호 그리기
   */
  private drawSignalOnModal(
    canvas: HTMLCanvasElement,
    signalData: Complex64Array,
    config: any,
    signalType: 'chirp' | 'echo'
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 60;

    // 배경 지우기
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, width, height);

    const numSamples = signalData.real.length;
    if (numSamples === 0) return;

    // 시간 벡터 생성
    const dt = 1.0 / config.fs;
    const timeUs: number[] = [];
    for (let i = 0; i < numSamples; i++) {
      timeUs.push(i * dt * 1e6);
    }

    // 데이터 준비
    const real = Array.from(signalData.real);
    const imag = Array.from(signalData.imag);
    const magnitude = Array.from(SignalDataProcessor.computeMagnitude(signalData));

    // 정규화 (Echo Signal인 경우)
    const normalize = signalType === 'echo';
    if (normalize) {
      const maxMag = Math.max(...magnitude);
      if (maxMag > 0) {
        for (let i = 0; i < real.length; i++) {
          real[i] /= maxMag;
          imag[i] /= maxMag;
          magnitude[i] /= maxMag;
        }
      }
    }

    // 스케일 계산
    const timeMin = Math.min(...timeUs);
    const timeMax = Math.max(...timeUs);
    const timeRange = timeMax - timeMin;

    const plotHeight = height - 2 * padding;
    const plotWidth = width - 2 * padding;

    // 그리드 그리기
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 20; i++) {
      const y = padding + (plotHeight / 20) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // 시간 축 그리기
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 20; i++) {
      const x = padding + (plotWidth / 20) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
      
      // X축 눈금 값 표시 (5개 간격으로)
      if (i % 4 === 0) {
        const timeValue = timeMin + (timeRange / 20) * i;
        ctx.fillStyle = '#aaa';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(timeValue.toFixed(1), x, height - padding + 18);
      }
    }

    // Y축 눈금 값 표시
    ctx.fillStyle = '#aaa';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    // Real/Imaginary용 Y축 (중간 기준)
    const maxAmplitude = Math.max(
      Math.max(...real.map(Math.abs)),
      Math.max(...imag.map(Math.abs))
    );
    for (let i = 0; i <= 20; i += 4) {
      const y = padding + (plotHeight / 20) * i;
      const value = maxAmplitude * (1 - (i / 20) * 2); // -maxAmplitude ~ +maxAmplitude
      ctx.fillText(value.toFixed(2), padding - 8, y + 5);
    }
    // 신호 그리기
    const scaleX = plotWidth / timeRange;
    const scaleY = plotHeight / 2;

    // 실수부
    ctx.strokeStyle = '#9C27B0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < numSamples; i++) {
      const x = padding + (timeUs[i] - timeMin) * scaleX;
      const y = padding + plotHeight / 2 - real[i] * scaleY;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // 허수부
    ctx.strokeStyle = '#FF9800';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < numSamples; i++) {
      const x = padding + (timeUs[i] - timeMin) * scaleX;
      const y = padding + plotHeight / 2 - imag[i] * scaleY;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // 크기
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < numSamples; i++) {
      const x = padding + (timeUs[i] - timeMin) * scaleX;
      const y = padding + plotHeight - magnitude[i] * scaleY;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Echo Signal인 경우 최대값 표시
    if (signalType === 'echo') {
      const maxIdx = magnitude.indexOf(Math.max(...magnitude));
      if (maxIdx >= 0) {
        const maxX = padding + (timeUs[maxIdx] - timeMin) * scaleX;
        ctx.strokeStyle = '#f44336';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(maxX, padding);
        ctx.lineTo(maxX, height - padding);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 레이블
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Time (μs)', width / 2, height - 20);

    ctx.save();
    ctx.translate(25, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Amplitude', 0, 0);
    ctx.restore();

    // 제목
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${signalType === 'chirp' ? 'Chirp' : 'Echo'} Signal - Time Domain`, padding, padding - 15);

    // 범례
    const legendY = padding + 30;
    ctx.strokeStyle = '#9C27B0';
    ctx.beginPath();
    ctx.moveTo(padding + 20, legendY);
    ctx.lineTo(padding + 50, legendY);
    ctx.stroke();
    ctx.fillStyle = '#9C27B0';
    ctx.font = '14px sans-serif';
    ctx.fillText('Real', padding + 55, legendY + 5);

    ctx.strokeStyle = '#FF9800';
    ctx.beginPath();
    ctx.moveTo(padding + 120, legendY);
    ctx.lineTo(padding + 150, legendY);
    ctx.stroke();
    ctx.fillStyle = '#FF9800';
    ctx.fillText('Imaginary', padding + 155, legendY + 5);

    ctx.strokeStyle = '#2196F3';
    ctx.beginPath();
    ctx.moveTo(padding + 260, legendY);
    ctx.lineTo(padding + 290, legendY);
    ctx.stroke();
    ctx.fillStyle = '#2196F3';
    ctx.fillText('Magnitude', padding + 295, legendY + 5);
  }

  /**
   * 사이드바 표시
   */
  show(): void {
    if (this.sidebar) {
      this.sidebar.classList.remove('collapsed');
      // 사이드바가 완전히 렌더링될 때까지 약간의 지연
      // 이렇게 하면 Canvas 크기 계산이 정확해집니다
    }
  }

  /**
   * 사이드바 숨기기
   */
  hide(): void {
    if (this.sidebar) {
      this.sidebar.classList.add('collapsed');
    }
  }

  /**
   * Chirp 신호 시각화
   */
  displayChirpSignal(
    chirpData: Complex64Array,
    config: any,
    options: SignalVisualizationOptions = {}
  ): void {
    // 데이터 저장 (모달에서 사용)
    this.currentChirpData = chirpData;
    this.currentConfig = config;
    if (!this.chirpCanvas) return;

    const {
      showReal = true,
      showImag = true,
      showMagnitude = true,
      normalize = false
    } = options;

    // 사이드바가 열린 후 Canvas 크기 계산을 위해 약간의 지연
    // requestAnimationFrame을 두 번 사용하여 사이드바 렌더링 완료 보장
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const ctx = this.chirpCanvas!.getContext('2d');
        if (!ctx) return;

        // 사이드바 컨텐츠 영역의 실제 너비를 기준으로 캔버스 크기 계산
        // 초기 비율 유지: 370:400 (width:height)
        const contentArea = document.getElementById('signalResultsContent');
        let width = 370; // 기본값
        let height = 400; // 기본값
        
        if (contentArea) {
          const contentRect = contentArea.getBoundingClientRect();
          // 패딩 15px * 2 = 30px 제외
          width = Math.floor(contentRect.width - 30);
          // 초기 비율 유지 (370:400 = 0.925)
          height = Math.floor(width * (400 / 370));
        } else {
          // 사이드바가 아직 열리지 않았거나 컨텐츠 영역을 찾을 수 없으면 기본값 사용
          const rect = this.chirpCanvas!.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            width = Math.floor(rect.width);
            height = Math.floor(width * (400 / 370)); // 비율 유지
          }
        }
        
        // 최소 크기 보장
        if (width < 200) width = 370;
        if (height < 200) height = 400;
      
      this.chirpCanvas!.width = width;
      this.chirpCanvas!.height = height;
      const padding = 40;

      // 배경 지우기
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, width, height);

      const numSamples = chirpData.real.length;
      if (numSamples === 0) return;

      // 시간 벡터 생성 (마이크로초)
      const dt = 1.0 / config.fs;
      const timeUs: number[] = [];
      for (let i = 0; i < numSamples; i++) {
        timeUs.push(i * dt * 1e6);
      }

      // 데이터 준비
      const real = Array.from(chirpData.real);
      const imag = Array.from(chirpData.imag);
      const magnitude = Array.from(SignalDataProcessor.computeMagnitude(chirpData));

      // 정규화
      if (normalize) {
        const maxMag = Math.max(...magnitude);
        if (maxMag > 0) {
          for (let i = 0; i < real.length; i++) {
            real[i] /= maxMag;
            imag[i] /= maxMag;
            magnitude[i] /= maxMag;
          }
        }
      }

      // 스케일 계산
      const timeMin = Math.min(...timeUs);
      const timeMax = Math.max(...timeUs);
      const timeRange = timeMax - timeMin;

      const plotHeight = height - 2 * padding;
      const plotWidth = width - 2 * padding;

      // 그리드 그리기
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) {
        const y = padding + (plotHeight / 10) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
      }

      // 시간 축 그리기
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) {
        const x = padding + (plotWidth / 10) * i;
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, height - padding);
        ctx.stroke();
        
        // X축 눈금 값 표시
        const timeValue = timeMin + (timeRange / 10) * i;
        ctx.fillStyle = '#aaa';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(timeValue.toFixed(1), x, height - padding + 15);
      }

      // Y축 눈금 값 표시
      ctx.fillStyle = '#aaa';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      // Real/Imaginary용 Y축 (중간 기준)
      const maxAmplitude = Math.max(
        Math.max(...real.map(Math.abs)),
        Math.max(...imag.map(Math.abs))
      );
      for (let i = 0; i <= 10; i++) {
        const y = padding + (plotHeight / 10) * i;
        const value = maxAmplitude * (1 - (i / 10) * 2); // -maxAmplitude ~ +maxAmplitude
        ctx.fillText(value.toFixed(2), padding - 5, y + 4);
      }
      // 신호 그리기
      const scaleX = plotWidth / timeRange;
      const scaleY = plotHeight / 2;

      // 실수부
      if (showReal) {
        ctx.strokeStyle = '#9C27B0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < numSamples; i++) {
          const x = padding + (timeUs[i] - timeMin) * scaleX;
          const y = padding + plotHeight / 2 - real[i] * scaleY;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      // 허수부
      if (showImag) {
        ctx.strokeStyle = '#FF9800';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < numSamples; i++) {
          const x = padding + (timeUs[i] - timeMin) * scaleX;
          const y = padding + plotHeight / 2 - imag[i] * scaleY;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      // 크기
      if (showMagnitude) {
        ctx.strokeStyle = '#2196F3';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < numSamples; i++) {
          const x = padding + (timeUs[i] - timeMin) * scaleX;
          const y = padding + plotHeight - magnitude[i] * scaleY;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      // 레이블
      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Time (μs)', width / 2, height - 10);

      ctx.save();
      ctx.translate(15, height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('Amplitude', 0, 0);
      ctx.restore();

      // 제목
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Chirp Signal - Time Domain', padding, padding - 10);

      // 범례
      const legendY = padding + 20;
      if (showReal) {
        ctx.strokeStyle = '#9C27B0';
        ctx.beginPath();
        ctx.moveTo(padding + 10, legendY);
        ctx.lineTo(padding + 30, legendY);
        ctx.stroke();
        ctx.fillStyle = '#9C27B0';
        ctx.fillText('Real', padding + 35, legendY + 4);
      }
      if (showImag) {
        ctx.strokeStyle = '#FF9800';
        ctx.beginPath();
        ctx.moveTo(padding + 80, legendY);
        ctx.lineTo(padding + 100, legendY);
        ctx.stroke();
        ctx.fillStyle = '#FF9800';
        ctx.fillText('Imaginary', padding + 105, legendY + 4);
      }
      if (showMagnitude) {
        ctx.strokeStyle = '#2196F3';
        ctx.beginPath();
        ctx.moveTo(padding + 180, legendY);
        ctx.lineTo(padding + 200, legendY);
        ctx.stroke();
        ctx.fillStyle = '#2196F3';
        ctx.fillText('Magnitude', padding + 205, legendY + 4);
      }
      });
    });
  }

  /**
   * Echo 신호 시각화
   */
  displayEchoSignal(
    echoData: Complex64Array,
    config: any,
    options: SignalVisualizationOptions = {}
  ): void {
    // 데이터 저장 (모달에서 사용)
    this.currentEchoData = echoData;
    this.currentConfig = config;
    if (!this.echoCanvas) return;

    const {
      showReal = true,
      showImag = true,
      showMagnitude = true,
      normalize = false
    } = options;

    // 사이드바가 열린 후 Canvas 크기 계산을 위해 약간의 지연
    // requestAnimationFrame을 두 번 사용하여 사이드바 렌더링 완료 보장
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const ctx = this.echoCanvas!.getContext('2d');
        if (!ctx) return;

        // 사이드바 컨텐츠 영역의 실제 너비를 기준으로 캔버스 크기 계산
        // 초기 비율 유지: 370:350 (width:height)
        const contentArea = document.getElementById('signalResultsContent');
        let width = 370; // 기본값
        let height = 350; // 기본값
        
        if (contentArea) {
          const contentRect = contentArea.getBoundingClientRect();
          // 패딩 15px * 2 = 30px 제외
          width = Math.floor(contentRect.width - 30);
          // 초기 비율 유지 (370:350 = 약 1.057)
          height = Math.floor(width * (350 / 370));
        } else {
          // 사이드바가 아직 열리지 않았거나 컨텐츠 영역을 찾을 수 없으면 기본값 사용
          const rect = this.echoCanvas!.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            width = Math.floor(rect.width);
            height = Math.floor(width * (350 / 370)); // 비율 유지
          }
        }
        
        // 최소 크기 보장
        if (width < 200) width = 370;
        if (height < 200) height = 350;
      
      this.echoCanvas!.width = width;
      this.echoCanvas!.height = height;
      const padding = 40;

      // 배경 지우기
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, width, height);

      const numSamples = echoData.real.length;
      if (numSamples === 0) return;

      // 시간 벡터 생성 (마이크로초)
      const dt = 1.0 / config.fs;
      const timeUs: number[] = [];
      for (let i = 0; i < numSamples; i++) {
        timeUs.push(i * dt * 1e6);
      }

      // 데이터 준비
      const real = Array.from(echoData.real);
      const imag = Array.from(echoData.imag);
      const magnitude = Array.from(SignalDataProcessor.computeMagnitude(echoData));

      // 정규화
      if (normalize) {
        const maxMag = Math.max(...magnitude);
        if (maxMag > 0) {
          for (let i = 0; i < real.length; i++) {
            real[i] /= maxMag;
            imag[i] /= maxMag;
            magnitude[i] /= maxMag;
          }
        }
      }

      // 스케일 계산
      const timeMin = Math.min(...timeUs);
      const timeMax = Math.max(...timeUs);
      const timeRange = timeMax - timeMin;

      const plotHeight = height - 2 * padding;
      const plotWidth = width - 2 * padding;

      // 그리드 그리기
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) {
        const y = padding + (plotHeight / 10) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
      }

      // 시간 축 그리기
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) {
        const x = padding + (plotWidth / 10) * i;
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, height - padding);
        ctx.stroke();
        
        // X축 눈금 값 표시
        const timeValue = timeMin + (timeRange / 10) * i;
        ctx.fillStyle = '#aaa';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(timeValue.toFixed(1), x, height - padding + 15);
      }

      // Y축 눈금 값 표시
      ctx.fillStyle = '#aaa';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      // Real/Imaginary용 Y축 (중간 기준)
      const maxAmplitude = Math.max(
        Math.max(...real.map(Math.abs)),
        Math.max(...imag.map(Math.abs))
      );
      for (let i = 0; i <= 10; i++) {
        const y = padding + (plotHeight / 10) * i;
        const value = maxAmplitude * (1 - (i / 10) * 2); // -maxAmplitude ~ +maxAmplitude
        ctx.fillText(value.toFixed(2), padding - 5, y + 4);
      }
      // 신호 그리기
      const scaleX = plotWidth / timeRange;
      const scaleY = plotHeight / 2;

      // 실수부
      if (showReal) {
        ctx.strokeStyle = '#9C27B0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < numSamples; i++) {
          const x = padding + (timeUs[i] - timeMin) * scaleX;
          const y = padding + plotHeight / 2 - real[i] * scaleY;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      // 허수부
      if (showImag) {
        ctx.strokeStyle = '#FF9800';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < numSamples; i++) {
          const x = padding + (timeUs[i] - timeMin) * scaleX;
          const y = padding + plotHeight / 2 - imag[i] * scaleY;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      // 크기
      if (showMagnitude) {
        ctx.strokeStyle = '#2196F3';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < numSamples; i++) {
          const x = padding + (timeUs[i] - timeMin) * scaleX;
          const y = padding + plotHeight - magnitude[i] * scaleY;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      // 최대값 표시
      const maxIdx = magnitude.indexOf(Math.max(...magnitude));
      if (maxIdx >= 0) {
        const maxX = padding + (timeUs[maxIdx] - timeMin) * scaleX;
        ctx.strokeStyle = '#f44336';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(maxX, padding);
        ctx.lineTo(maxX, height - padding);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 레이블
      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Time (μs)', width / 2, height - 10);

      ctx.save();
      ctx.translate(15, height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('Amplitude', 0, 0);
      ctx.restore();

      // 제목
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Echo Signal - Time Domain', padding, padding - 10);

      // 범례
      const legendY = padding + 20;
      if (showReal) {
        ctx.strokeStyle = '#9C27B0';
        ctx.beginPath();
        ctx.moveTo(padding + 10, legendY);
        ctx.lineTo(padding + 30, legendY);
        ctx.stroke();
        ctx.fillStyle = '#9C27B0';
        ctx.fillText('Real', padding + 35, legendY + 4);
      }
      if (showImag) {
        ctx.strokeStyle = '#FF9800';
        ctx.beginPath();
        ctx.moveTo(padding + 80, legendY);
        ctx.lineTo(padding + 100, legendY);
        ctx.stroke();
        ctx.fillStyle = '#FF9800';
        ctx.fillText('Imaginary', padding + 105, legendY + 4);
      }
      if (showMagnitude) {
        ctx.strokeStyle = '#2196F3';
        ctx.beginPath();
        ctx.moveTo(padding + 180, legendY);
        ctx.lineTo(padding + 200, legendY);
        ctx.stroke();
        ctx.fillStyle = '#2196F3';
        ctx.fillText('Magnitude', padding + 205, legendY + 4);
      }
      });
    });
  }

  /**
   * 통계 정보 표시
   */
  displayStatistics(
    chirpStats: SignalStatistics | null,
    echoStats: SignalStatistics | null
  ): void {
    // Chirp 통계
    if (this.chirpStatisticsDiv && chirpStats) {
      this.chirpStatisticsDiv.innerHTML = `
        <div style="font-size: 12px; color: #ccc; margin-top: 10px;">
          <strong>Chirp Signal 통계:</strong><br>
          최대 진폭: ${chirpStats.max.toExponential(3)}<br>
          평균 진폭: ${chirpStats.mean.toExponential(3)}<br>
          ${chirpStats.min !== undefined ? `최소 진폭: ${chirpStats.min.toExponential(3)}<br>` : ''}
          샘플 수: ${chirpStats.totalSamples || 0}
        </div>
      `;
    }

    // Echo 통계
    if (this.echoStatisticsDiv && echoStats) {
      this.echoStatisticsDiv.innerHTML = `
        <div style="font-size: 12px; color: #ccc; margin-top: 10px;">
          <strong>Echo Signal 통계:</strong><br>
          최대 진폭: ${echoStats.max.toExponential(3)}<br>
          평균 진폭: ${echoStats.mean.toExponential(3)}<br>
          ${echoStats.min !== undefined ? `최소 진폭: ${echoStats.min.toExponential(3)}<br>` : ''}
          Non-zero 샘플: ${echoStats.nonZeroSamples || 0} / ${echoStats.totalSamples || 0}
        </div>
      `;
    }
  }

  /**
   * 상세 Chirp Signal 그래프 표시 (6개 서브플롯)
   * test_integration.py의 visualize_chirp_signal과 동일한 방식
   */
  displayDetailedChirpSignal(chirpData: Complex64Array, config: any): void {
    if (!this.detailedChirpCanvas) {
      console.warn('상세 Chirp Canvas를 찾을 수 없습니다.');
      return;
    }

    // Canvas 표시
    this.detailedChirpCanvas.style.display = 'block';

    requestAnimationFrame(() => {
      const ctx = this.detailedChirpCanvas!.getContext('2d');
      if (!ctx) return;

      const contentArea = document.getElementById('signalResultsContent');
      let width = 370;
      let height = 400;

      if (contentArea) {
        const contentRect = contentArea.getBoundingClientRect();
        width = Math.floor(contentRect.width - 30);
        // 높이는 고정 (단일 서브플롯)
        height = 400;
      }

      this.detailedChirpCanvas!.width = width;
      this.detailedChirpCanvas!.height = height;

      const numSamples = chirpData.real.length;
      if (numSamples === 0) return;

      // 시간 벡터 생성 (중심이 0이 되도록)
      const dt = 1.0 / config.fs;
      const n = numSamples;
      const t: number[] = [];
      for (let i = 0; i < n; i++) {
        t.push((i - n / 2) * dt);
      }
      const tUs = t.map(tVal => tVal * 1e6); // 마이크로초 단위

      // Chirp rate 계산
      const chirpRate = config.bw / config.taup;
      const instantaneousFreq = t.map(tVal => chirpRate * tVal);

      // 반송파 주파수 포함 신호 계산
      const phiWithCarrier = t.map(tVal => 
        2 * Math.PI * (config.fc * tVal + (chirpRate / 2) * tVal * tVal)
      );
      const chirpWithCarrier = phiWithCarrier.map(phi => Math.cos(phi));

      // 복소수 배열에서 데이터 추출
      const real = Array.from(chirpData.real);
      const imag = Array.from(chirpData.imag);
      const magnitude = Array.from(SignalDataProcessor.computeMagnitude(chirpData));
      const phase = Array.from(SignalDataProcessor.computePhase(chirpData));

      // FFT 계산은 더 이상 필요 없음 (Time Domain만 표시)

      // 서브플롯 설정 (Time Domain with Carrier Frequency만 표시)
      const numSubplots = 1;
      const subplotHeight = height;
      const padding = 50;
      const plotWidth = width - 2 * padding;
      const plotHeight = subplotHeight - padding * 2;

      // 배경 지우기
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, width, height);

      // 1. 시간 영역 (반송파 포함) - 이것만 표시
      this.drawSubplot(
        ctx,
        0,
        subplotHeight,
        padding,
        plotWidth,
        plotHeight,
        tUs,
        chirpWithCarrier,
        'Time (μs)',
        'Amplitude',
        'Chirp Signal - Time Domain (With Carrier Frequency)',
        '#9C27B0',
        { min: Math.min(...tUs), max: Math.max(...tUs) }
      );
    });
  }

  /**
   * 단일 라인 서브플롯 그리기
   */
  private drawSubplot(
    ctx: CanvasRenderingContext2D,
    subplotIndex: number,
    subplotHeight: number,
    padding: number,
    plotWidth: number,
    plotHeight: number,
    xData: number[],
    yData: number[],
    xLabel: string,
    yLabel: string,
    title: string,
    color: string,
    xRange: { min: number; max: number }
  ): void {
    const yOffset = subplotIndex * subplotHeight;
    const xMin = xRange.min;
    const xMax = xRange.max;
    const xRangeVal = xMax - xMin;
    const yMin = Math.min(...yData);
    const yMax = Math.max(...yData);
    const yRange = yMax - yMin || 1;

    // 그리드 그리기
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const y = yOffset + padding + (plotHeight / 10) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + plotWidth, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 10; i++) {
      const x = padding + (plotWidth / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, yOffset + padding);
      ctx.lineTo(x, yOffset + padding + plotHeight);
      ctx.stroke();
    }

    // 데이터 그리기
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < xData.length; i++) {
      const x = padding + ((xData[i] - xMin) / xRangeVal) * plotWidth;
      const y = yOffset + padding + plotHeight - ((yData[i] - yMin) / yRange) * plotHeight;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // 제목 및 레이블
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, padding + plotWidth / 2, yOffset + 20);

    ctx.fillStyle = '#aaa';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(xLabel, padding + plotWidth / 2, yOffset + padding + plotHeight + 25);

    ctx.save();
    ctx.translate(15, yOffset + padding + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();
  }

  /**
   * 이중 라인 서브플롯 그리기
   */
  private drawDualLineSubplot(
    ctx: CanvasRenderingContext2D,
    subplotIndex: number,
    subplotHeight: number,
    padding: number,
    plotWidth: number,
    plotHeight: number,
    xData: number[],
    yData1: number[],
    yData2: number[],
    xLabel: string,
    yLabel: string,
    title: string,
    color1: string,
    color2: string,
    label1: string,
    label2: string,
    xRange: { min: number; max: number },
    yRange?: { min: number; max: number }
  ): void {
    const yOffset = subplotIndex * subplotHeight;
    const xMin = xRange.min;
    const xMax = xRange.max;
    const xRangeVal = xMax - xMin;
    
    const allY = [...yData1, ...yData2];
    const yMin = yRange ? yRange.min : Math.min(...allY);
    const yMax = yRange ? yRange.max : Math.max(...allY);
    const yRangeVal = yMax - yMin || 1;

    // 그리드 그리기
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const y = yOffset + padding + (plotHeight / 10) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + plotWidth, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 10; i++) {
      const x = padding + (plotWidth / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, yOffset + padding);
      ctx.lineTo(x, yOffset + padding + plotHeight);
      ctx.stroke();
    }

    // 첫 번째 라인
    ctx.strokeStyle = color1;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < xData.length; i++) {
      const x = padding + ((xData[i] - xMin) / xRangeVal) * plotWidth;
      const y = yOffset + padding + plotHeight - ((yData1[i] - yMin) / yRangeVal) * plotHeight;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // 두 번째 라인
    ctx.strokeStyle = color2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < xData.length; i++) {
      const x = padding + ((xData[i] - xMin) / xRangeVal) * plotWidth;
      const y = yOffset + padding + plotHeight - ((yData2[i] - yMin) / yRangeVal) * plotHeight;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // 범례
    ctx.fillStyle = color1;
    ctx.fillRect(padding + plotWidth - 150, yOffset + padding + 10, 10, 10);
    ctx.fillStyle = '#fff';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label1, padding + plotWidth - 135, yOffset + padding + 18);

    ctx.fillStyle = color2;
    ctx.fillRect(padding + plotWidth - 150, yOffset + padding + 25, 10, 10);
    ctx.fillStyle = '#fff';
    ctx.fillText(label2, padding + plotWidth - 135, yOffset + padding + 33);

    // 제목 및 레이블
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, padding + plotWidth / 2, yOffset + 20);

    ctx.fillStyle = '#aaa';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(xLabel, padding + plotWidth / 2, yOffset + padding + plotHeight + 25);

    ctx.save();
    ctx.translate(15, yOffset + padding + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();
  }

  /**
   * 확대 영역 서브플롯 그리기
   */
  private drawZoomRegionsSubplot(
    ctx: CanvasRenderingContext2D,
    subplotIndex: number,
    subplotHeight: number,
    padding: number,
    plotWidth: number,
    plotHeight: number,
    tData: number[],
    yData: number[],
    regions: Array<{ name: string; start: number; end: number; color: string }>,
    xLabel: string,
    yLabel: string,
    title: string
  ): void {
    const yOffset = subplotIndex * subplotHeight;
    const tUs = tData.map(t => t * 1e6);

    // 각 영역 그리기
    regions.forEach((region, regionIdx) => {
      const startIdx = tData.findIndex(t => t >= region.start);
      const endIdx = tData.findIndex(t => t >= region.end);
      if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return;

      const regionTUs = tUs.slice(startIdx, endIdx);
      const regionY = yData.slice(startIdx, endIdx);
      const xMin = Math.min(...regionTUs);
      const xMax = Math.max(...regionTUs);
      const xRange = xMax - xMin;
      const yMin = Math.min(...regionY);
      const yMax = Math.max(...regionY);
      const yRange = yMax - yMin || 1;

      ctx.strokeStyle = region.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < regionTUs.length; i++) {
        const x = padding + ((regionTUs[i] - xMin) / xRange) * (plotWidth / regions.length) + (plotWidth / regions.length) * regionIdx;
        const y = yOffset + padding + plotHeight - ((regionY[i] - yMin) / yRange) * plotHeight;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    });

    // 제목 및 레이블
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, padding + plotWidth / 2, yOffset + 20);

    ctx.fillStyle = '#aaa';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(xLabel, padding + plotWidth / 2, yOffset + padding + plotHeight + 25);
  }

  /**
   * 모달에 상세 Chirp Signal 그리기
   */
  private drawDetailedChirpOnModal(canvas: HTMLCanvasElement, chirpData: Complex64Array, config: any): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 60;

    const numSamples = chirpData.real.length;
    if (numSamples === 0) return;

    // 시간 벡터 생성 (중심이 0이 되도록)
    const dt = 1.0 / config.fs;
    const n = numSamples;
    const t: number[] = [];
    for (let i = 0; i < n; i++) {
      t.push((i - n / 2) * dt);
    }
    const tUs = t.map(tVal => tVal * 1e6); // 마이크로초 단위

    // Chirp rate 계산
    const chirpRate = config.bw / config.taup;

    // 반송파 주파수 포함 신호 계산
    const phiWithCarrier = t.map(tVal => 
      2 * Math.PI * (config.fc * tVal + (chirpRate / 2) * tVal * tVal)
    );
    const chirpWithCarrier = phiWithCarrier.map(phi => Math.cos(phi));

    const plotHeight = height - 2 * padding;
    const plotWidth = width - 2 * padding;

    // 배경 지우기
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, width, height);

    // 그리드 그리기
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 20; i++) {
      const y = padding + (plotHeight / 20) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 20; i++) {
      const x = padding + (plotWidth / 20) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    }

    // X축 레이블
    const xMin = Math.min(...tUs);
    const xMax = Math.max(...tUs);
    const xRange = xMax - xMin;
    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 10; i++) {
      const x = padding + (plotWidth / 10) * i;
      const timeValue = xMin + (xRange / 10) * i;
      ctx.fillText(timeValue.toFixed(1), x, height - padding + 20);
    }

    // Y축 레이블
    const yMin = Math.min(...chirpWithCarrier);
    const yMax = Math.max(...chirpWithCarrier);
    const yRange = yMax - yMin || 1;
    ctx.textAlign = 'right';
    for (let i = 0; i <= 10; i++) {
      const y = padding + (plotHeight / 10) * i;
      const value = yMax - (yRange / 10) * i;
      ctx.fillText(value.toFixed(2), padding - 10, y + 5);
    }

    // 제목
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Chirp Signal - Time Domain (With Carrier Frequency)', width / 2, 30);

    // 축 레이블
    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Time (μs)', width / 2, height - 10);

    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Amplitude', 0, 0);
    ctx.restore();

    // 신호 그리기
    const scaleX = plotWidth / xRange;
    const scaleY = plotHeight / yRange;
    const centerY = padding + plotHeight / 2;

    ctx.strokeStyle = '#9C27B0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < numSamples; i++) {
      const x = padding + (tUs[i] - xMin) * scaleX;
      const y = centerY - (chirpWithCarrier[i] - (yMin + yMax) / 2) * scaleY;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  /**
   * 간단한 FFT 계산 (실제로는 더 정교한 FFT 라이브러리 사용 권장)
   */
  private computeFFT(real: Float32Array, imag: Float32Array, dt: number): { freq: number[]; magnitude: number[] } {
    const n = real.length;
    const freq: number[] = [];
    const magnitude: number[] = [];

    // 간단한 DFT 구현 (성능을 위해 실제 FFT 라이브러리 사용 권장)
    for (let k = 0; k < n; k++) {
      let sumReal = 0;
      let sumImag = 0;
      for (let j = 0; j < n; j++) {
        const angle = -2 * Math.PI * k * j / n;
        sumReal += real[j] * Math.cos(angle) - imag[j] * Math.sin(angle);
        sumImag += real[j] * Math.sin(angle) + imag[j] * Math.cos(angle);
      }
      const mag = Math.sqrt(sumReal * sumReal + sumImag * sumImag);
      magnitude.push(mag);
      freq.push((k < n / 2 ? k : k - n) / (n * dt) / 1e6); // MHz
    }

    return { freq, magnitude };
  }
}
