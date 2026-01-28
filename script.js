// Initialize jsPDF
window.jsPDF = window.jspdf.jsPDF;

// Get Plate Number for Filename
function getPlateNumber() {
  // Find the input field with "رقم اللوحة" label
  const headers = document.querySelectorAll('.w-28.sm\\:w-32.bg-gray-100');
  for (const header of headers) {
    if (header.textContent.trim() === 'رقم اللوحة') {
      const input = header.parentElement.querySelector('input[type="text"]');
      if (input && input.value.trim()) {
        // تنظيف رقم اللوحة: إزالة المسافات واستبدال الأحرف الخاصة
        return input.value.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '');
      }
    }
  }
  return 'تقرير_فحص_حافلة';
}

document.addEventListener('DOMContentLoaded', function () {
  // DOM Elements
  const printBtn = document.querySelector('button[title="طباعة"]');
  const pdfBtn = document.querySelector('button[title="تصدير PDF"]');
  const clearBtn = document.querySelector('button[title="مسح"]');
  const modal = document.getElementById('busDiagramModal');
  const modalImg = document.getElementById('modalDiagramImg');
  const diagramContainer = document.getElementById('diagramContainer');
  const closeModalBtn = document.getElementById('closeModalBtn');

  // Button Events
  function validateFullForm() {
    // First, validate header fields (رقم اللوحة، التاريخ، إلخ)
    const headerInputs = document.querySelectorAll('.mb-6.print\\:mb-2 input[type="text"], .mb-6.print\\:mb-2 input[type="date"]');
    const fieldLabels = ['رقم اللوحة', 'التاريخ', 'رقم التشغيل', 'عدد المقاعد', 'اسم المدرسة', 'عدد الكيلومتر'];
    
    for (let i = 0; i < headerInputs.length; i++) {
      const input = headerInputs[i];
      if (!input.value || input.value.trim() === '') {
        const fieldName = fieldLabels[i] || 'حقل إلزامي';
        return { name: fieldName, section: 'معلومات أساسية', element: input };
      }
    }
    
    const isMobile = window.matchMedia('(max-width: 1279px)').matches;
    const desktopRows = Array.from(document.querySelectorAll('table tbody tr')).filter(r => !r.querySelector('.percent-badge'));
    const mobileCards = Array.from(document.querySelectorAll('.lg\\:hidden .p-4.flex.flex-col.gap-3'));
    
    // Validate based on current view (mobile or desktop)
    const itemsToCheck = isMobile ? mobileCards : desktopRows;
    
    for (let i = 0; i < itemsToCheck.length; i++) {
       const item = itemsToCheck[i];
       let itemName, select, sectionName;
       
       if (isMobile) {
         // Mobile card
         const nameEl = item.querySelector('.font-medium');
         itemName = nameEl ? nameEl.innerText.trim() : 'بند';
         select = item.querySelector('select');
         const cardContainer = item.closest('.rounded-lg');
         const headerEl = cardContainer ? cardContainer.querySelector('.bg-gray-100') : null;
         sectionName = headerEl ? headerEl.innerText.trim() : '';
       } else {
         // Desktop row
         itemName = item.cells[0] ? item.cells[0].innerText.trim() : 'بند';
         select = item.querySelector('select');
         const table = item.closest('table');
         const headerEl = table ? table.querySelector('th[colspan]') : null;
         sectionName = headerEl ? headerEl.innerText.trim() : '';
       }
       
       // Exceptions: Bus Diagram and Notes columns
       if (itemName.includes('مخطط الحافلة') || itemName.includes('ملاحظات')) continue;
       
       // If select exists and is empty (mandatory)
       if (select && !select.value) {
          return { name: itemName, section: sectionName, element: item };
       }
    }
    return null;
  }

  function validateAndAction(action) {
     const error = validateFullForm();
     if (error) {
        showToast(`عفواً: يرجى إكمال بند "${error.name}" في قسم "${error.section}" أولاً`, 'error');
        
        // Scroll with offset for mobile devices to account for fixed header
        const yOffset = -100; // Offset for fixed progress bar
        const element = error.element;
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
        
        window.scrollTo({ top: y, behavior: 'smooth' });
        
        // Visual cue - works on both mobile and desktop
        if (error.element.classList) {
           error.element.classList.add('ring-2', 'ring-red-500', 'bg-red-50');
           setTimeout(() => {
              error.element.classList.remove('ring-2', 'ring-red-500', 'bg-red-50');
           }, 2500);
        }
        return;
     }
     action();
  }

  if (printBtn) printBtn.addEventListener('click', () => validateAndAction(() => {
    // Copy textarea content to print divs before printing
    document.querySelectorAll('textarea').forEach(textarea => {
      const parent = textarea.closest('.grid');
      if (parent) {
        const printDiv = parent.querySelector('.print\\:block');
        if (printDiv) {
          printDiv.textContent = textarea.value;
        }
      }
    });
    
    // Copy date values to print spans in signature section
    document.querySelectorAll('input[type="date"]').forEach(dateInput => {
      if (dateInput.value) {
        const parent = dateInput.parentElement;
        if (parent && parent.classList.contains('relative')) {
          const printSpan = parent.querySelector('.print\\:flex span');
          if (printSpan) {
            // Format date as YYYY/MM/DD
            const date = new Date(dateInput.value);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            printSpan.textContent = `${year}/${month}/${day}`;
          }
        }
      }
    });
    
    // Copy select (dropdown) values to print divs for evaluation items
    document.querySelectorAll('select').forEach(select => {
      if (select.value) {
        const parent = select.parentElement;
        if (parent) {
          const printDiv = parent.querySelector('.print\\:block');
          if (printDiv) {
            printDiv.textContent = select.value;
          }
        }
      }
    });
    
    window.print();
  }));
  if (pdfBtn) pdfBtn.addEventListener('click', () => validateAndAction(exportToPDF));
  if (clearBtn) clearBtn.addEventListener('click', clearForm);

  // Signature Screen (open on click)
  const signatureModal = document.getElementById('signatureModal');
  const signatureModalCanvas = document.getElementById('signatureModalCanvas');
  const signatureCloseBtn = document.getElementById('signatureCloseBtn');
  const signatureClearBtn = document.getElementById('signatureClearBtn');
  const signatureSaveBtn = document.getElementById('signatureSaveBtn');

  const SIGNATURE_LINE_WIDTH = 3.5;
  let currentSignatureColor = '#000000';
  // Increase resolution scale to 3x for ultra-sharp rendering
  const CANVAS_SCALE = Math.max(window.devicePixelRatio || 1, 3);

  const signatureBoxes = Array.from(document.querySelectorAll('canvas[title="انقر هنا للتوقيع"]'));
  let activeSignatureBox = null;
  let signatureBaseImage = null; // snapshot of existing signature when opening modal

  function setupSignatureContext(ctx) {
    ctx.strokeStyle = currentSignatureColor;
    ctx.lineWidth = SIGNATURE_LINE_WIDTH * CANVAS_SCALE;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }

  function resizeCanvasToDisplaySize(canvas) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    
    const displayWidth = Math.round(rect.width * CANVAS_SCALE);
    const displayHeight = Math.round(rect.height * CANVAS_SCALE);
    
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      // Save current content
      const snapshot = document.createElement('canvas');
      snapshot.width = canvas.width;
      snapshot.height = canvas.height;
      const sctx = snapshot.getContext('2d', { willReadFrequently: true });
      sctx.drawImage(canvas, 0, 0);

      // Resize
      canvas.width = displayWidth;
      canvas.height = displayHeight;

      // Restore content
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      // Disable smoothing for restoration to avoid compounding blur
      ctx.imageSmoothingEnabled = false; 
      ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, canvas.width, canvas.height);
      
      setupSignatureContext(ctx);
      return true;
    }
    return false;
  }

  // Initialize all signature boxes with high resolution
  signatureBoxes.forEach(canvas => {
    resizeCanvasToDisplaySize(canvas);
    setupSignatureContext(canvas.getContext('2d', { willReadFrequently: true }));
  });

  // Handle Pen Color Change
  document.querySelectorAll('input[name="sigColor"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentSignatureColor = e.target.value;
      if (signatureModalCanvas) {
        const ctx = signatureModalCanvas.getContext('2d', { willReadFrequently: true });
        setupSignatureContext(ctx);
      }
    });
  });

  function openSignatureModalFor(canvas) {
    if (!signatureModal || !signatureModalCanvas) return;
    activeSignatureBox = canvas;
    signatureModal.classList.remove('hidden');

    // Use setTimeout to ensure the modal is fully rendered and has dimensions
    setTimeout(() => {
      resizeCanvasToDisplaySize(signatureModalCanvas);

      const ctx = signatureModalCanvas.getContext('2d', { willReadFrequently: true });
      setupSignatureContext(ctx);
      
      // Clear and draw the existing signature from the small box
      ctx.clearRect(0, 0, signatureModalCanvas.width, signatureModalCanvas.height);
      if (activeSignatureBox) {
        // Draw the small signature scaled up. It might be blurry because the source is small.
        // We enable smoothing to make it look better than pixelated.
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
          activeSignatureBox,
          0,
          0,
          activeSignatureBox.width,
          activeSignatureBox.height,
          0,
          0,
          signatureModalCanvas.width,
          signatureModalCanvas.height
        );
      }
      // Snapshot the current (existing) signature so edits don't erase it during redraws
      signatureBaseImage = ctx.getImageData(0, 0, signatureModalCanvas.width, signatureModalCanvas.height);
    }, 50);
  }

  function closeSignatureModal() {
    if (!signatureModal) return;
    signatureModal.classList.add('hidden');
    activeSignatureBox = null;
  }

  // Open modal when clicking any signature box
  signatureBoxes.forEach(canvas => {
    canvas.addEventListener('click', e => {
      e.preventDefault();
      openSignatureModalFor(canvas);
    });
  });

  // Draw inside modal canvas (Pointer Events: mouse + touch)
  if (signatureModalCanvas) {
    const ctx = signatureModalCanvas.getContext('2d', { willReadFrequently: true });
    let isDrawing = false;
    let points = [];

    function addPoint(pt) {
      if (!points.length) {
        points.push(pt);
        return true;
      }
      const last = points[points.length - 1];
      const dx = pt.x - last.x;
      const dy = pt.y - last.y;
      const dist2 = dx * dx + dy * dy;
      // Ignore ultra-short moves to reduce jitter/dots (increased threshold)
      if (dist2 < 2) return false;
      points.push(pt);
      return true;
    }

    function getPos(e) {
      const rect = signatureModalCanvas.getBoundingClientRect();
      const scaleX = signatureModalCanvas.width / rect.width;
      const scaleY = signatureModalCanvas.height / rect.height;
      return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY];
    }

    function drawSmoothLine() {
      if (points.length === 0) return;

      setupSignatureContext(ctx);
      ctx.beginPath();
      
      if (points.length < 3) {
        // If we have only one or two points, just draw a line
        const p0 = points[0];
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
      } else {
        // Use a more advanced smoothing algorithm for 3+ points
        ctx.moveTo(points[0].x, points[0].y);
        let i;
        for (i = 1; i < points.length - 2; i++) {
          const c = (points[i].x + points[i + 1].x) / 2;
          const d = (points[i].y + points[i + 1].y) / 2;
          ctx.quadraticCurveTo(points[i].x, points[i].y, c, d);
        }
        // For the last 2 points
        ctx.quadraticCurveTo(
          points[i].x,
          points[i].y,
          points[i + 1].x,
          points[i + 1].y
        );
      }
      ctx.stroke();
    }

    signatureModalCanvas.addEventListener('pointerdown', e => {
      e.preventDefault();
      // Ensure canvas size is correct before starting
      const resized = resizeCanvasToDisplaySize(signatureModalCanvas);
      
      // If we resized, we need to re-capture the base image because the old one is invalid/scaled
      // But wait, resizeCanvasToDisplaySize restores the content.
      // So we just need to grab the new state.
      if (resized || !signatureBaseImage) {
         signatureBaseImage = ctx.getImageData(0, 0, signatureModalCanvas.width, signatureModalCanvas.height);
      }

      isDrawing = true;
      points = [];
      signatureModalCanvas.setPointerCapture(e.pointerId);
      
      const [x, y] = getPos(e);
      addPoint({ x, y });

      // Redraw immediately to show the first dot
      ctx.clearRect(0, 0, signatureModalCanvas.width, signatureModalCanvas.height);
      if (signatureBaseImage) {
        ctx.putImageData(signatureBaseImage, 0, 0);
      }
      drawSmoothLine();
    });

    signatureModalCanvas.addEventListener('pointermove', e => {
      if (!isDrawing) return;
      e.preventDefault();

      const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
      
      for (const ev of events) {
        const [x, y] = getPos(ev);
        addPoint({ x, y });
      }
      
      // Redraw entire smooth line
      ctx.clearRect(0, 0, signatureModalCanvas.width, signatureModalCanvas.height);
      if (signatureBaseImage) {
        ctx.putImageData(signatureBaseImage, 0, 0);
      }
      drawSmoothLine();
    });

    function stopDrawing() {
      if (isDrawing && points.length > 0) {
        // This final draw ensures the last segment is committed
        ctx.clearRect(0, 0, signatureModalCanvas.width, signatureModalCanvas.height);
        if (signatureBaseImage) {
          ctx.putImageData(signatureBaseImage, 0, 0);
        }
        drawSmoothLine();
      }
      isDrawing = false;
      // After the stroke is done, the "base image" for the *next* stroke
      // becomes the canvas with the stroke we just drew.
      signatureBaseImage = ctx.getImageData(0, 0, signatureModalCanvas.width, signatureModalCanvas.height);
      points = [];
    }

    signatureModalCanvas.addEventListener('pointerup', stopDrawing);
    signatureModalCanvas.addEventListener('pointercancel', stopDrawing);
    signatureModalCanvas.addEventListener('pointerleave', stopDrawing);
  }

  if (signatureCloseBtn) signatureCloseBtn.addEventListener('click', closeSignatureModal);
  
  // Close signature modal when clicking on the backdrop
  if (signatureModal) {
    signatureModal.addEventListener('mousedown', (e) => {
      if (e.target === signatureModal) {
        closeSignatureModal();
      }
    });
  }

  if (signatureClearBtn && signatureModalCanvas) {
    signatureClearBtn.addEventListener('click', () => {
      const ctx = signatureModalCanvas.getContext('2d', { willReadFrequently: true });
      ctx.clearRect(0, 0, signatureModalCanvas.width, signatureModalCanvas.height);
      signatureBaseImage = null;
    });
  }

  if (signatureSaveBtn && signatureModalCanvas) {
    signatureSaveBtn.addEventListener('click', () => {
      if (!activeSignatureBox) return closeSignatureModal();
      
      // Ensure the destination canvas is also set up for high quality
      const destCtx = activeSignatureBox.getContext('2d', { willReadFrequently: true });
      setupSignatureContext(destCtx);
      
      destCtx.clearRect(0, 0, activeSignatureBox.width, activeSignatureBox.height);
      destCtx.drawImage(
        signatureModalCanvas,
        0,
        0,
        signatureModalCanvas.width,
        signatureModalCanvas.height,
        0,
        0,
        activeSignatureBox.width,
        activeSignatureBox.height
      );
      closeSignatureModal();
      saveToLocal(true); // حفظ تلقائي فوري عند اعتماد التوقيع
    });
  }

  // Delete Signature
  document.querySelectorAll('button').forEach(btn => {
    if (btn.textContent.trim() === 'حذف التوقيع') {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const canvas = this.closest('.flex-col').querySelector('canvas');
        if (canvas) {
          canvas.getContext('2d', { willReadFrequently: true }).clearRect(0, 0, canvas.width, canvas.height);
          saveToLocal(true); // حفظ تلقائي فوري عند حذف التوقيع
        }
      });
    }
  });

  // 🤖 AI-Powered PDF Export with Intelligent Summary
  async function exportToPDF() {
    try {
      // Validate before export
      const error = validateFullForm();
      if (error) {
        showToast(`عفواً: يرجى إكمال بند "${error.name}" في قسم "${error.section}" أولاً`, 'error');
        return;
      }
      
      showToast('⏳ جاري تحضير ملف PDF...', 'info');
      
      // Prepare form for capture (same as print)
      // Copy textarea content to print divs
      document.querySelectorAll('textarea').forEach(textarea => {
        const parent = textarea.closest('.grid');
        if (parent) {
          const printDiv = parent.querySelector('.print\\:block');
          if (printDiv) {
            printDiv.textContent = textarea.value;
          }
        }
      });
      
      // Copy date values to print spans
      document.querySelectorAll('input[type="date"]').forEach(dateInput => {
        if (dateInput.value) {
          const parent = dateInput.parentElement;
          if (parent && parent.classList.contains('relative')) {
            const printSpan = parent.querySelector('.print\\:flex span');
            if (printSpan) {
              const date = new Date(dateInput.value);
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              printSpan.textContent = `${year}/${month}/${day}`;
            }
          }
        }
      });
      
      // Copy select values to print divs
      document.querySelectorAll('select').forEach(select => {
        if (select.value) {
          const parent = select.parentElement;
          if (parent) {
            const printDiv = parent.querySelector('.print\\:block');
            if (printDiv) {
              printDiv.textContent = select.value;
            }
          }
        }
      });
      
      // Temporarily hide no-print elements
      const noPrintElements = document.querySelectorAll('.no-print');
      noPrintElements.forEach(el => el.style.display = 'none');
      
      // Capture the form
      const container = document.querySelector('.form-container');
      const canvas = await html2canvas(container, { 
        scale: 1.5, 
        useCORS: true, 
        backgroundColor: '#fff',
        logging: false,
        windowWidth: 1200
      });
      
      // Restore no-print elements
      noPrintElements.forEach(el => el.style.display = '');
      
      // Generate PDF - fit to single page
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jspdf.jsPDF('p', 'mm', 'a4');
      
      // A4 dimensions in mm
      const pdfWidth = 210;
      const pdfHeight = 297;
      
      // Calculate dimensions to fit entire content on one page
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      
      // If height exceeds page, scale down to fit
      if (imgHeight > pdfHeight) {
        const scale = pdfHeight / imgHeight;
        const finalWidth = imgWidth * scale;
        const finalHeight = pdfHeight;
        const xOffset = (pdfWidth - finalWidth) / 2; // Center horizontally
        pdf.addImage(imgData, 'PNG', xOffset, 0, finalWidth, finalHeight);
      } else {
        // Content fits, center vertically
        const yOffset = (pdfHeight - imgHeight) / 2;
        pdf.addImage(imgData, 'PNG', 0, yOffset, imgWidth, imgHeight);
      }
      
      // Save with plate number
      const plateNumber = getPlateNumber();
      const timestamp = new Date().toISOString().slice(0,10);
      pdf.save(`${plateNumber}_${timestamp}.pdf`);
      
      showToast('✅ تم حفظ ملف PDF بنجاح!', 'success');
      
    } catch (e) {
      console.error(e);
      showToast('خطأ في التصدير: ' + e.message, 'error');
    }
  }

  // 📊 Generate Comprehensive AI Report
  function generateAIReport() {
    const allSections = {};
    let totalScore = 0;
    let sectionCount = 0;
    
    // Collect data from all sections
    document.querySelectorAll('table').forEach(table => {
      const sectionHeader = table.querySelector('thead th[colspan]');
      const sectionName = sectionHeader ? sectionHeader.innerText.trim() : '';
      
      if (!sectionName) return;
      
      const rows = Array.from(table.querySelectorAll('tbody tr')).filter(r => !r.querySelector('.percent-badge'));
      let sectionData = {
        totalItems: 0,
        passedItems: 0,
        failedItems: 0,
        avgScore: 0,
        issues: []
      };
      
      rows.forEach(row => {
        const checkboxes = row.querySelectorAll('input[type=\"checkbox\"]');
        if (checkboxes.length < 2) return;
        
        sectionData.totalItems++;
        if (checkboxes[0].checked) sectionData.passedItems++;
        if (checkboxes[1].checked) {
          sectionData.failedItems++;
          const itemName = row.cells[0]?.innerText.trim() || 'بند';
          const select = row.querySelector('select');
          sectionData.issues.push({
            item: itemName,
            text: select?.value || 'فشل'
          });
        }
      });
      
      const badge = table.querySelector('.percent-badge');
      if (badge) {
        sectionData.score = parseInt(badge.value) || 0;
        sectionData.avgScore = sectionData.score;
        totalScore += sectionData.score;
        sectionCount++;
      }
      
      allSections[sectionName] = sectionData;
    });
    
    // Calculate overall score
    const overallScore = sectionCount > 0 ? Math.round(totalScore / sectionCount) : 0;
    
    // Detect patterns
    const patterns = AI_ENGINE.detectPatterns(allSections);
    
    // Generate human-like summary
    const summary = AI_ENGINE.generateHumanSummary({
      overall: { score: overallScore },
      sections: allSections,
      patterns: patterns,
      timestamp: new Date().toISOString()
    });
    
    return summary;
  }

  // Clear Form
  function clearForm() {
    if (!confirm('مسح كل البيانات؟')) return;
    localStorage.removeItem('bus_inspection_v1'); // Clear local storage
    document.querySelectorAll('input, textarea, select').forEach(el => {
      if (el.type === 'checkbox') el.checked = false;
      else if (el.tagName === 'SELECT') el.selectedIndex = 0;
      else el.value = '';
    });
    document.querySelectorAll('canvas').forEach(c => c.getContext('2d', { willReadFrequently: true }).clearRect(0, 0, c.width, c.height));
    document.querySelectorAll('.percent-badge').forEach(b => { b.value = '0%'; b.style.color = '#dc2626'; });
    damageMarkers = []; renderPrintMarkers(); 
    document.querySelectorAll('table').forEach(updateTableStatus);
    showToast('تم المسح!', 'info');
  }

  // ============================================
  // 🤖 HYBRID AI MODEL - Advanced Analysis Engine
  // ============================================
  
  // 📊 نظام النسب الدقيق حسب ملف التقييم
  const EVALUATION_SCORES = {
    // 🛠️ قسم الصيانة
    'الحالة الميكانيكية': {
      'ممتازة': 100,
      'جيدة': 90,
      'متوسطة': 75,
      'تحتاج صيانة': 50,
      'متوقفة عن العمل': 0
    },
    'كهرباء الحافلة': {
      'سليمة': 100,
      'ملاحظة بسيطة': 90,
      'عطل جزئي': 70,
      'تحتاج فحص فني': 60,
      'عطل كامل': 0
    },
    'البطاريات': {
      'جديدة': 100,
      'بحالة جيدة': 90,
      'تحتاج شحن': 75,
      'ضعيفة': 60,
      'تحتاج استبدال': 0
    },
    'الإطارات': {
      'جديدة': 100,
      'جيدة': 90,
      'متوسطة': 70,
      'تالفة جزئياً': 40,
      'تحتاج استبدال فوري': 0
    },
    
    // 🚧 قسم الحوادث والتأمين
    'الهيكل الخارجي': {
      'سليم': 100,
      'خدوش بسيطة': 90,
      'أضرار متوسطة': 60,
      'أضرار جسيمة': 30,
      'يحتاج إصلاح عاجل': 0
    },
    'الزجاج': {
      'سليم': 100,
      'شرخ بسيط': 85,
      'كسر جزئي': 60,
      'يحتاج استبدال': 40,
      'كسر كامل': 0
    },
    'علامة قف': {
      'موجودة وتعمل': 100,
      'تحتاج صيانة': 80,
      'موجودة ولا تعمل': 40,
      'تالفة': 20,
      'غير موجودة': 0
    },
    'ذراع الأمان': {
      'يعمل بكفاءة': 100,
      'يوجد حساسات امامية وخلفية': 100, // لا خصم
      'يعمل جزئياً': 60,
      'لا يعمل': 20,
      'تالف': 0,
      'غير موجود': 0
    },
    
    // 🚍 قسم الأسطول
    'الأوراق الثبوتية': {
      'مكتملة وسارية': 100,
      'مكتملة وقريبة الانتهاء': 85,
      'تحتاج تحديث': 70,
      'ناقصة': 40,
      'منتهية الصلاحية': 0
    },
    'الملصقات': {
      'موجودة وواضحة': 100,
      'موجودة وباهتة': 80,
      'ناقصة': 60,
      'تالفة': 40,
      'غير موجودة': 0
    },
    'الديكور والمقاعد': {
      'نظيفة وسليمة': 100,
      'مقبولة': 85,
      'تحتاج تنظيف': 70,
      'تالفة جزئياً': 40,
      'تالفة وتحتاج إصلاح': 0
    },
    'شرائح الديزل': {
      'سليمة': 100,
      'فعالة جزئياً': 70,
      'تحتاج إعادة برمجة': 60,
      'لا تعمل': 30,
      'تحتاج استبدال': 0
    },
    'أدوات الأمن والسلامة': {
      'مكتملة وسليمة': 100,
      'مكتملة مع ملاحظات': 85,
      'ناقصة': 50,
      'تالفة': 30,
      'غير موجودة': 0
    },
    'زر الأمان': {
      'يعمل': 100,
      'يعمل أحياناً': 70,
      'لا يعمل': 30,
      'تالف': 0,
      'غير موجود': 0
    },
    
    // 👨‍✈️ قسم السائق
    'الالتزام بمواعيد الدوام': {
      'ملتزم تماماً': 100,
      'ملتزم غالباً': 90,
      'تأخير بسيط': 75,
      'تأخير متكرر': 40,
      'غير ملتزم': 0
    },
    'المظهر الشخصي': {
      'لائق ومطابق للتعليمات': 100,
      'مقبول': 85,
      'يحتاج تنبيه': 65,
      'غير لائق': 30,
      'مخالف للتعليمات': 0
    },
    'التعامل مع مراقبي التشغيل': {
      'ممتاز': 100,
      'جيد': 85,
      'مقبول': 70,
      'ضعيف': 40,
      'غير متعاون': 0
    },
    'الالتزام بالتعليمات الصادرة': {
      'ملتزم': 100,
      'ملتزم مع ملاحظات': 85,
      'مخالف أحياناً': 60,
      'مخالف باستمرار': 30,
      'غير ملتزم': 0
    },
    'المحافظة على نظافة الحافلة': {
      'ممتازة': 100,
      'جيدة': 90,
      'مقبولة': 75,
      'سيئة': 40,
      'مهملة': 0
    },
    'المواظبة على الفحص النظري': {
      'مواظب': 100,
      'مواظب غالباً': 85,
      'غير منتظم': 60,
      'نادراً': 40,
      'لا يقوم بالفحص': 0
    },
    'الإبلاغ عن الأعطال ومتابعتها': {
      'يبلغ ويتابع': 100,
      'يبلغ فقط': 80,
      'يتأخر في الإبلاغ': 60,
      'لا يتابع': 30,
      'لا يبلغ عن الأعطال': 0
    }
  };

  // دالة للحصول على نسبة التقييم حسب البند والخيار
  function getEvaluationScore(itemName, selectedValue) {
    if (!selectedValue || selectedValue === '' || selectedValue === '-- اختر --' || selectedValue === '-- اختر التقييم --') {
      return null; // لم يتم التقييم
    }
    
    // البحث عن البند في جدول النسب
    const itemScores = EVALUATION_SCORES[itemName];
    if (itemScores && itemScores[selectedValue] !== undefined) {
      return itemScores[selectedValue];
    }
    
    // إذا لم يوجد البند، نبحث عن تطابق جزئي
    for (const [key, scores] of Object.entries(EVALUATION_SCORES)) {
      if (itemName.includes(key) || key.includes(itemName)) {
        if (scores[selectedValue] !== undefined) {
          return scores[selectedValue];
        }
      }
    }
    
    // Fallback: استخدام النظام القديم للكلمات المفتاحية
    return null;
  }

  const AI_ENGINE = {
    // Data Analysis Patterns (Fallback)
    patterns: {
      excellent: { score: 100, keywords: ['ممتاز', 'سليم', 'جديد', 'مكتمل', 'نظيف', 'موجودة وتعمل', 'يعمل بكفاءة', 'مكتملة وسارية', 'موجودة وواضحة', 'نظيفة وسليمة', 'يعمل', 'ملتزم تماماً', 'لائق ومطابق', 'مواظب', 'يبلغ ويتابع'], risk: 'منخفض جداً' },
      good: { score: 85, keywords: ['جيد', 'ملاحظة بسيطة', 'خدوش بسيطة', 'شرخ بسيط', 'بحالة جيدة', 'ملتزم غالباً', 'مواظب غالباً', 'يبلغ فقط'], risk: 'منخفض' },
      acceptable: { score: 65, keywords: ['متوسط', 'مقبول', 'جزئي', 'يعمل جزئياً', 'أضرار متوسطة', 'فعالة جزئياً', 'تأخير بسيط', 'يحتاج تنبيه', 'غير منتظم'], risk: 'متوسط' },
      warning: { score: 40, keywords: ['تحتاج', 'ضعيف', 'تالف', 'ناقص', 'موجودة ولا تعمل', 'لا تعمل', 'تأخير متكرر', 'ضعيف', 'يتأخر في الإبلاغ', 'سيئة', 'نادراً'], risk: 'عالي' },
      critical: { score: 15, keywords: ['متوقف', 'عطل كامل', 'كسر كامل', 'غير موجود', 'يحتاج إصلاح عاجل', 'أضرار جسيمة', 'منتهية الصلاحية', 'غير ملتزم', 'مخالف', 'لا يقوم', 'لا يتابع', 'لا يبلغ', 'مهملة'], risk: 'حرج' }
    },

    // Smart Evaluation Score Calculator with Exact Percentages
    calculateSmartScore(evaluations, sectionName) {
      if (evaluations.length === 0) return 0;
      
      let totalWeight = 0;
      let weightedScore = 0;
      
      evaluations.forEach(evalItem => {
        const { itemName, value, passed } = evalItem;
        
        // أولاً: البحث عن النسبة الدقيقة من جدول النسب
        let itemScore = getEvaluationScore(itemName, value);
        
        // إذا لم نجد نسبة دقيقة، نستخدم النظام القديم
        if (itemScore === null) {
          if (value) {
            itemScore = this.analyzeLinguisticScore(value);
          } else {
            itemScore = passed ? 100 : 0;
          }
        }
        
        // Section-specific weighting
        const weight = this.getItemWeight(itemName, sectionName);
        weightedScore += itemScore * weight;
        totalWeight += weight;
      });
      
      return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
    },
    
    // Linguistic Score Analysis (Fallback)
    analyzeLinguisticScore(text) {
      const lowerText = text.toLowerCase();
      
      // Check patterns in order of severity
      for (const [level, data] of Object.entries(this.patterns)) {
        for (const keyword of data.keywords) {
          if (lowerText.includes(keyword.toLowerCase())) {
            return data.score;
          }
        }
      }
      
      // Default to acceptable if no match
      return 65;
    },
    
    // Item Weight Based on Importance
    getItemWeight(itemName, sectionName) {
      const lowerItem = itemName.toLowerCase();
      
      // Critical items have higher weight
      const criticalKeywords = ['ميكانيكي', 'كهرباء', 'بطاري', 'إطار', 'هيكل', 'زجاج', 'أمان', 'ثبوتية', 'سلامة'];
      const isCritical = criticalKeywords.some(kw => lowerItem.includes(kw));
      
      if (isCritical) return 1.5; // 50% more weight
      return 1.0; // Normal weight
    },

    // Context-Aware Text Generation
    generateInsight(sectionName, data) {
      const { totalItems, passedItems, failedItems, avgScore, issues } = data;
      const passRate = totalItems > 0 ? (passedItems / totalItems * 100) : 0;
      
      let insight = '';
      let tone = '';
      let recommendation = '';

      // Dynamic Analysis Based on Context
      if (passRate >= 90) {
        tone = 'إيجابي';
        insight = `أداء ${sectionName} ممتاز بنسبة ${passRate.toFixed(0)}٪. `;
        recommendation = 'يُنصح بالحفاظ على هذا المستوى من خلال الصيانة الدورية.';
      } else if (passRate >= 70) {
        tone = 'جيد';
        insight = `أداء ${sectionName} جيد بشكل عام (${passRate.toFixed(0)}٪)، مع وجود بعض النقاط التي تحتاج متابعة. `;
        recommendation = failedItems > 0 ? 
          `تم رصد ${failedItems} بند/بنود تحتاج معالجة.` :
          'متابعة دورية للبنود التي تحتاج تحسين.';
      } else if (passRate >= 50) {
        tone = 'تحذيري';
        insight = `⚠️ ${sectionName} يحتاج اهتمام فوري (${passRate.toFixed(0)}٪). `;
        recommendation = `تم رصد ${failedItems} مشكلة/مشاكل تتطلب تدخل عاجل لتفادي توقف الخدمة.`;
      } else {
        tone = 'حرج';
        insight = `🚨 حالة ${sectionName} حرجة جداً (${passRate.toFixed(0)}٪)! `;
        recommendation = `خطر توقف فوري. يجب إيقاف التشغيل ومعالجة جميع المشاكل (${failedItems} بنود فاشلة).`;
      }

      return { insight, recommendation, tone, passRate };
    },

    // Intelligent Suggestions Generator
    generateSuggestions(sectionName, issues) {
      const suggestions = [];
      const priorityMap = { 'حرج': 1, 'عالي': 2, 'متوسط': 3, 'منخفض': 4 };

      issues.forEach(issue => {
        const analysis = this.analyzeIssue(issue.text, sectionName);
        suggestions.push({
          item: issue.item,
          priority: analysis.priority,
          action: analysis.action,
          timeline: analysis.timeline,
          cost: analysis.estimatedCost
        });
      });

      return suggestions.sort((a, b) => 
        priorityMap[a.priority] - priorityMap[b.priority]
      );
    },

    // Deep Issue Analysis
    analyzeIssue(issueText, context) {
      const lowerText = issueText.toLowerCase();
      
      // Critical patterns
      if (/عطل كامل|متوقف|كسر كامل|غير موجود/.test(lowerText)) {
        return {
          priority: 'حرج',
          action: 'استبدال فوري أو إصلاح شامل',
          timeline: 'خلال 24 ساعة',
          estimatedCost: 'عالية'
        };
      }
      
      // High priority
      if (/تحتاج استبدال|أضرار جسيمة|عطل جزئي|تالفة/.test(lowerText)) {
        return {
          priority: 'عالي',
          action: 'جدولة صيانة عاجلة',
          timeline: 'خلال 3 أيام',
          estimatedCost: 'متوسطة إلى عالية'
        };
      }
      
      // Medium priority
      if (/تحتاج صيانة|متوسط|ناقص|تنظيف/.test(lowerText)) {
        return {
          priority: 'متوسط',
          action: 'صيانة دورية مجدولة',
          timeline: 'خلال أسبوع',
          estimatedCost: 'منخفضة إلى متوسطة'
        };
      }
      
      // Low priority
      return {
        priority: 'منخفض',
        action: 'متابعة في الفحص القادم',
        timeline: 'حسب الجدول الدوري',
        estimatedCost: 'منخفضة'
      };
    },

    // Pattern Recognition & Prediction
    detectPatterns(allSectionsData) {
      const patterns = [];
      const sections = Object.keys(allSectionsData);
      
      // Detect correlation between sections
      if (allSectionsData['صيانة']?.avgScore < 60 && 
          allSectionsData['حوادث وتأمين']?.failedItems > 2) {
        patterns.push({
          type: 'correlation',
          description: 'انخفاض جودة الصيانة قد يكون مرتبطاً بزيادة الأضرار الخارجية'
        });
      }

      if (allSectionsData['السائق']?.avgScore < 70) {
        patterns.push({
          type: 'behavior',
          description: 'أداء السائق يحتاج تحسين، مما قد يؤثر على سلامة الحافلة'
        });
      }

      return patterns;
    },

    // Generate Human-Like Summary
    generateHumanSummary(formData) {
      const { overall, sections, patterns, timestamp } = formData;
      const dateObj = new Date(timestamp);
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      const date = `${day}-${month}-${year}`;
      
      let summary = `📋 تقرير فحص الحافلة - ${date}\n\n`;
      
      // Overall assessment
      if (overall.score >= 80) {
        summary += `✅ الحالة العامة: ممتازة (${overall.score}٪)\n`;
        summary += `الحافلة في حالة جيدة جداً وجاهزة للتشغيل.\n\n`;
      } else if (overall.score >= 60) {
        summary += `⚠️ الحالة العامة: مقبولة (${overall.score}٪)\n`;
        summary += `توجد بعض النقاط التي تحتاج معالجة قريباً.\n\n`;
      } else {
        summary += `🚨 الحالة العامة: غير مرضية (${overall.score}٪)\n`;
        summary += `الحافلة تحتاج صيانة شاملة قبل التشغيل.\n\n`;
      }

      // Section highlights
      summary += `📊 أبرز الملاحظات:\n`;
      Object.keys(sections).forEach(section => {
        const data = sections[section];
        if (data.score < 70) {
          summary += `  • ${section}: يحتاج اهتمام (${data.score}٪)\n`;
        }
      });

      // Patterns identified
      if (patterns.length > 0) {
        summary += `\n🔍 أنماط مكتشفة:\n`;
        patterns.forEach(p => {
          summary += `  • ${p.description}\n`;
        });
      }

      return summary;
    }
  };

  // Smart Form Logic
  const PASS_OPTIONS = [
    'ممتازة', 'جيدة', 'سليمة', 'جديدة', 'بحالة جيدة', 
    'موجودة وتعمل', 'يعمل بكفاءة', 'مكتملة وسارية', 
    'موجودة وواضحة', 'نظيفة وسليمة', 'مكتملة وسليمة', 
    'يعمل', 'ملتزم تماماً', 'ملتزم غالباً', 
    'لائق ومطابق للتعليمات', 'ممتاز', 'جيد', 'ملتزم', 
    'مواظب', 'مواظب غالباً', 'يبلغ ويتابع', 'سليم',
    'مقبولة', 'ملاحظة بسيطة', 'خدوش بسيطة', 'شرخ بسيط',
    'يعمل جزئياً', 'مكتملة وقريبة الانتهاء', 'موجودة وباهتة',
    'فعالة جزئياً', 'مكتملة مع ملاحظات', 'يعمل أحياناً',
    'تأخير بسيط', 'مقبول', 'ملتزم مع ملاحظات', 'يبلغ فقط',
    'متوسطة', 'تحتاج تنظيف', 'يحتاج تنبيه',
    'يوجد حساسات امامية وخلفية'
  ];

  const PERFECT_OPTIONS = [
    'ممتازة', 'سليمة', 'جديدة', 'موجودة وتعمل', 'يعمل بكفاءة', 
    'مكتملة وسارية', 'موجودة وواضحة', 'نظيفة وسليمة', 'مكتملة وسليمة', 
    'يعمل', 'ملتزم تماماً', 'لائق ومطابق للتعليمات', 'ممتاز', 
    'ملتزم', 'مواظب', 'يبلغ ويتابع', 'سليم',
    'يوجد حساسات امامية وخلفية'
  ];

  // Custom Toast Function
  function showToast(message, type = 'info') {
    let toast = document.getElementById('toast-notification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast-notification';
      toast.className = 'toast-notification';
      document.body.appendChild(toast);
    }
    
    // Reset classes
    toast.className = 'toast-notification';
    // Force reflow
    void toast.offsetWidth;
    
    toast.textContent = message;
    toast.classList.add(type);
    toast.classList.add('show');

    // Clear previous timeout if exists
    if (toast.timeoutId) clearTimeout(toast.timeoutId);

    toast.timeoutId = setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  function initSmartForm() {
    const desktopRows = Array.from(document.querySelectorAll('table tbody tr')).filter(row => !row.querySelector('.percent-badge'));
    const mobileCards = Array.from(document.querySelectorAll('.lg\\:hidden .p-4.flex.flex-col.gap-3'));

    const count = Math.max(desktopRows.length, mobileCards.length);

    for (let i = 0; i < count; i++) {
       setupSmartPair(desktopRows[i], mobileCards[i]);
    }
  }

  function setupSmartPair(row, card) {
     const getInputs = (container) => {
        if (!container) return null;
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        const select = container.querySelector('select');
        if (checkboxes.length < 2) return null;
        return { 
           pass: checkboxes[0], 
           fail: checkboxes[1], 
           select: select,
           container: container
        };
     };

     const d = getInputs(row);
     const m = getInputs(card);

     let itemName = "بند";
     if (row && row.cells) itemName = row.cells[0].innerText.trim();
     else if (card) {
        const t = card.querySelector('.font-medium');
        if (t) itemName = t.innerText.trim();
     }

     const syncAndTrigger = (finalPass, finalFail, finalSelect) => {
        // Sync Desktop
        if (d) {
           d.pass.checked = finalPass;
           d.fail.checked = finalFail;
           if (d.select && finalSelect !== undefined) d.select.value = finalSelect;
           triggerUpdate(d.container);
        }
        // Sync Mobile
        if (m) {
           m.pass.checked = finalPass;
           m.fail.checked = finalFail;
           if (m.select && finalSelect !== undefined) m.select.value = finalSelect;
           triggerUpdate(m.container);
        }
     };

     // Helper function to setup listeners (removes duplication)
     const setupListeners = (inputs) => {
        if (!inputs) return;
        
        if (inputs.select) {
           // Disable manual checkbox interaction completely (desktop & mobile)
           inputs.pass.style.pointerEvents = 'none';
           inputs.pass.style.opacity = '0.5';
           inputs.pass.style.cursor = 'not-allowed';
           inputs.pass.disabled = true;
           inputs.pass.setAttribute('title', 'يتم التحديد تلقائياً حسب التقييم');
           
           inputs.fail.style.pointerEvents = 'none';
           inputs.fail.style.opacity = '0.5';
           inputs.fail.style.cursor = 'not-allowed';
           inputs.fail.disabled = true;
           inputs.fail.setAttribute('title', 'يتم التحديد تلقائياً حسب التقييم');
           
           // Prevent all click/touch events (extra protection)
           const preventInteraction = (e) => {
              e.preventDefault();
              e.stopPropagation();
              return false;
           };
           
           inputs.pass.addEventListener('click', preventInteraction, true);
           inputs.pass.addEventListener('touchstart', preventInteraction, true);
           inputs.pass.addEventListener('touchend', preventInteraction, true);
           inputs.fail.addEventListener('click', preventInteraction, true);
           inputs.fail.addEventListener('touchstart', preventInteraction, true);
           inputs.fail.addEventListener('touchend', preventInteraction, true);
           
           // Use both 'change' and 'input' events for better mobile support
           const handleSelectChange = () => {
              const val = inputs.select.value;
              let p = false;
              let f = false;
              
              if (val) {
                 if (PASS_OPTIONS.includes(val)) { 
                    p = true; 
                    f = false; 
                 } else { 
                    f = true; 
                    p = false; 
                    showToast(`تنبيه: تم تسجيل فشل في بند "${itemName}" بسبب التقييم "${val}"`, 'error'); 
                 }
              }
              syncAndTrigger(p, f, val);
           };
           
           inputs.select.addEventListener('change', handleSelectChange);
           inputs.select.addEventListener('input', handleSelectChange);
        } else {
           // Fallback for rows without select
           const handlePassChange = () => {
              if (inputs.pass.checked) inputs.fail.checked = false;
              syncAndTrigger(inputs.pass.checked, inputs.fail.checked, undefined);
           };
           
           const handleFailChange = () => {
              if (inputs.fail.checked) {
                 inputs.pass.checked = false;
                 showToast(`تنبيه: تم تسجيل فشل في بند "${itemName}"`, 'error');
              }
              syncAndTrigger(inputs.pass.checked, inputs.fail.checked, undefined);
           };
           
           inputs.pass.addEventListener('change', handlePassChange);
           inputs.fail.addEventListener('change', handleFailChange);
        }
     };

     // Setup listeners for both desktop and mobile
     setupListeners(d);
     setupListeners(m);
  }

  function triggerUpdate(element) {
    // If element is in a table, update that table
    const table = element.closest('table');
    if (table) {
      updateTableStatus(table);
    } else {
      // If mobile, we just update the global progress bar
      updateProgressBar();
    }
  }

  function updateTableStatus(table) {
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    let totalItems = 0;
    let passedCount = 0;
    let issues = [];
    let evaluations = []; // For AI linguistic analysis
    
    // Get section name
    const sectionHeader = table.querySelector('thead th[colspan]');
    const sectionName = sectionHeader ? sectionHeader.innerText.trim() : '';

    rows.forEach(row => {
      if (row.querySelector('.percent-badge')) return;
      
      const checkboxes = row.querySelectorAll('input[type="checkbox"]');
      if (checkboxes.length < 2) return;

      const passCb = checkboxes[0];
      const failCb = checkboxes[1];
      const select = row.querySelector('select');
      const itemName = row.cells[0].innerText.trim();
      
      // Skip rows without evaluation select (like diagram column)
      if (!select) return;

      totalItems++;
      
      // Collect evaluation data for AI analysis
      if (passCb.checked || failCb.checked) {
        evaluations.push({
          itemName: itemName,
          passed: passCb.checked,
          value: select?.value || '',
          isCritical: itemName.toLowerCase().includes('أمان') || 
                      itemName.toLowerCase().includes('سلامة') ||
                      itemName.toLowerCase().includes('ميكانيكي') ||
                      itemName.toLowerCase().includes('كهرباء')
        });
      }
      
      // Notes Logic
      if (passCb.checked) {
        passedCount++;
        if (select && select.value && !PERFECT_OPTIONS.includes(select.value)) {
           issues.push(`- ${itemName}: ${select.value}`);
        }
      } else if (failCb.checked) {
        const reason = select && select.value ? select.value : 'فشل';
        issues.push(`- ${itemName}: ${reason}`);
      }
    });

    // 🤖 AI-Powered Smart Scoring with Linguistic Analysis
    let finalPercent = 0;
    
    if (evaluations.length > 0) {
      // Use AI linguistic analysis for intelligent scoring
      finalPercent = AI_ENGINE.calculateSmartScore(evaluations, sectionName);
    } else {
      finalPercent = 0;
    }
    
    const badge = table.querySelector('.percent-badge');
    if (badge) {
      badge.value = finalPercent + '%';
      // Color Coding: Green >= 80, Yellow 50-79, Red < 50
      if (finalPercent >= 80) {
         badge.style.color = '#16a34a'; // Green
      } else if (finalPercent >= 50) {
         badge.style.color = '#ca8a04'; // Yellow
      } else {
         badge.style.color = '#dc2626'; // Red
      }
    }

    // 🤖 AI-Generated Smart Notes
    const textarea = table.querySelector('textarea');
    if (textarea) {
      // Prepare data for AI analysis
      const analysisData = {
        totalItems,
        passedItems: passedCount,
        failedItems: totalItems - passedCount,
        avgScore: finalPercent, // Use the AI-calculated score
        issues: issues.map(i => {
          const parts = i.split(': ');
          return { item: parts[0].replace('- ', ''), text: parts[1] || '' };
        })
      };

      // Generate intelligent insights
      const aiInsight = AI_ENGINE.generateInsight(sectionName, analysisData);
      
      // Build dynamic notes
      let notes = '';
      
      if (issues.length > 0) {
        notes += `${aiInsight.insight}\n\n`;
        notes += `📝 تفاصيل الملاحظات:\n${issues.join('\n')}\n\n`;
        notes += `⚠️ ${aiInsight.recommendation}`;
      } else if (passedCount === totalItems && totalItems > 0) {
        notes = `✅ ${aiInsight.insight}\n\n`;
        notes += `جميع بنود ${sectionName} اجتازت الفحص بنجاح. `;
        notes += `${aiInsight.recommendation}`;
      } else if (evaluations.length < totalItems) {
        notes = `⏳ لم يتم إكمال فحص جميع البنود بعد.\n\n`;
        notes += `تم فحص ${evaluations.length} من ${totalItems} بنود. يرجى إكمال الفحص للحصول على تقييم شامل.`;
      } else {
        notes = "";
      }
      
      textarea.value = notes;
      
      // Store analysis for later use
      textarea.dataset.aiAnalysis = JSON.stringify(aiInsight);
    }
    
    updateProgressBar();
  }

  function updateProgressBar() {
    const pass = Array.from(document.querySelectorAll('input[type="checkbox"]')).filter((_,i)=>i%2===0);
    const done = pass.filter(cb=>cb.checked).length;
    const total = pass.length;
    const pct = total ? Math.round((done/total)*100) : 0;
    const bar = document.querySelector('.bg-blue-400');
    const text = document.querySelector('.text-blue-600 + span');
    if (bar) bar.style.width = pct + '%';
    if (text) text.textContent = pct + '%';
  }

  // Damage Markers
  let damageMarkers = [];

  const inlineDiagramImgs = Array.from(document.querySelectorAll('img[alt="Diagram"]'));
  const diagramWrappers = (() => {
    const seen = new Set();
    const wrappers = [];
    inlineDiagramImgs.forEach(img => {
      const wrapper = img.closest('.relative');
      if (!wrapper) return;
      if (seen.has(wrapper)) return;
      seen.add(wrapper);
      wrappers.push(wrapper);
    });
    return wrappers;
  })();

  function renderModalMarkers() {
    if (!diagramContainer) return;
    diagramContainer.querySelectorAll('.damage-marker').forEach(el => el.remove());
    damageMarkers.forEach(m => {
      const el = document.createElement('div');
      el.className = 'damage-marker absolute cursor-pointer z-10 select-none';
      el.style.left = m.x + '%';
      el.style.top = m.y + '%';
      el.style.transform = 'translate(-50%,-50%)';
      el.style.fontSize = '18px';
      el.style.lineHeight = '1';
      el.textContent = '❌';
      el.addEventListener('click', ev => {
        ev.stopPropagation();
        damageMarkers = damageMarkers.filter(mm => !(mm.x === m.x && mm.y === m.y));
        el.remove();
        renderPrintMarkers();
      });
      diagramContainer.appendChild(el);
    });
  }

  function openDiagramModal(src) {
    if (!modal || !modalImg) return;
    modalImg.src = src;
    renderModalMarkers();
    modal.classList.remove('hidden');
  }

  inlineDiagramImgs.forEach(img => {
    img.addEventListener('click', () => openDiagramModal(img.src));
  });

  if (diagramContainer && modalImg) {
    diagramContainer.addEventListener('click', e => {
      if (e.target === modalImg) {
        const rect = modalImg.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        const xPct = parseFloat(x.toFixed(2));
        const yPct = parseFloat(y.toFixed(2));
        damageMarkers.push({ x: xPct, y: yPct });
        const el = document.createElement('div');
        el.className = 'damage-marker absolute cursor-pointer z-10 select-none';
        el.style.left = xPct + '%';
        el.style.top = yPct + '%';
        el.style.transform = 'translate(-50%,-50%)';
        el.style.fontSize = '18px';
        el.style.lineHeight = '1';
        el.textContent = '❌';
        el.addEventListener('click', ev => {
          ev.stopPropagation();
          damageMarkers = damageMarkers.filter(m => !(m.x === xPct && m.y === yPct));
          el.remove();
          renderPrintMarkers();
        });
        diagramContainer.appendChild(el);
        renderPrintMarkers();
      }
    });
  }

  if (closeModalBtn && modal) {
    closeModalBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
      renderPrintMarkers();
    });
    
    // Close modal when clicking on the backdrop
    modal.addEventListener('mousedown', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
        renderPrintMarkers();
      }
    });
  }

  function renderPrintMarkers() {
    if (!diagramWrappers.length) return;
    diagramWrappers.forEach(wrapper => {
      wrapper.querySelectorAll('.damage-marker-print').forEach(el => el.remove());
      damageMarkers.forEach(m => {
        const el = document.createElement('div');
        // مرئية على المخطط داخل الصفحة + ستظهر أيضاً عند الطباعة
        el.className = 'damage-marker-print absolute pointer-events-none select-none';
        el.style.left = m.x + '%';
        el.style.top = m.y + '%';
        el.style.transform = 'translate(-50%,-50%)';
        el.style.zIndex = '10';
        el.textContent = '❌';
        wrapper.appendChild(el);
      });
    });
  }

  // Init Smart Form
  initSmartForm();

  // --- Offline Saving Logic ---
  const STORAGE_KEY = 'bus_inspection_v1';
  const saveBtn = document.querySelector('button[title="حفظ محلي"]');

  function saveToLocal(silent = false) {
    const data = {
      inputs: [],
      checkboxes: [],
      selects: [],
      textareas: [],
      signatures: [],
      markers: damageMarkers
    };

    document.querySelectorAll('input:not([type="checkbox"])').forEach((el, index) => {
       data.inputs.push({ index, value: el.value });
    });
    document.querySelectorAll('input[type="checkbox"]').forEach((el, index) => {
       data.checkboxes.push({ index, checked: el.checked });
    });
    document.querySelectorAll('select').forEach((el, index) => {
       data.selects.push({ index, value: el.value });
    });
    document.querySelectorAll('textarea').forEach((el, index) => {
       data.textareas.push({ index, value: el.value });
    });
    document.querySelectorAll('canvas[title="انقر هنا للتوقيع"]').forEach((canvas, index) => {
       data.signatures.push({ index, data: canvas.toDataURL() });
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      if (!silent) showToast('تم الحفظ محلياً بنجاح', 'success');
    } catch (e) {
      console.error(e);
      if (!silent) showToast('فشل الحفظ (الذاكرة ممتلئة؟)', 'error');
    }
  }

  function loadFromLocal() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    
    try {
      const data = JSON.parse(raw);
      
      const inputs = document.querySelectorAll('input:not([type="checkbox"])');
      data.inputs?.forEach(item => { if (inputs[item.index]) inputs[item.index].value = item.value; });

      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      data.checkboxes?.forEach(item => { if (checkboxes[item.index]) checkboxes[item.index].checked = item.checked; });

      const selects = document.querySelectorAll('select');
      data.selects?.forEach(item => { if (selects[item.index]) selects[item.index].value = item.value; });

      const textareas = document.querySelectorAll('textarea');
      data.textareas?.forEach(item => { if (textareas[item.index]) textareas[item.index].value = item.value; });

      const sigCanvases = document.querySelectorAll('canvas[title="انقر هنا للتوقيع"]');
      data.signatures?.forEach(item => {
         if (sigCanvases[item.index] && item.data) {
            const img = new Image();
            img.onload = () => {
               const ctx = sigCanvases[item.index].getContext('2d', { willReadFrequently: true });
               // مسح الكانفاس ورسم الصورة بحجمها الكامل لتناسب الأبعاد الحالية
               ctx.clearRect(0, 0, sigCanvases[item.index].width, sigCanvases[item.index].height);
               ctx.drawImage(img, 0, 0, sigCanvases[item.index].width, sigCanvases[item.index].height);
            };
            img.src = item.data;
         }
      });

      if (data.markers) {
         damageMarkers = data.markers;
         renderPrintMarkers();
      }

      // Update UI
      document.querySelectorAll('table').forEach(updateTableStatus);
      updateProgressBar();
      showToast('تم استرجاع البيانات المحفوظة', 'info');
    } catch (e) {
      console.error(e);
    }
  }

  if (saveBtn) saveBtn.addEventListener('click', () => validateAndAction(() => saveToLocal(false)));

  // Auto-save on change
  document.addEventListener('change', () => saveToLocal(true));
  document.addEventListener('input', () => saveToLocal(true));

  // Load on startup
  loadFromLocal();

  // Init
  const today = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[type="date"]:not([value])').forEach(i => i.value = today);
  document.querySelectorAll('table').forEach(updateTableStatus);
  renderPrintMarkers();
  
  // Prevent zoom on iOS when focusing on inputs
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
  }
  
  // Extra protection: Monitor and prevent any manual checkbox changes
  document.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox' && e.target.disabled) {
      e.preventDefault();
      e.stopPropagation();
      showToast('مربعات الاختيار يتم تحديدها تلقائياً حسب التقييم المختار', 'info');
      return false;
    }
  }, true);
  
  // Prevent direct manipulation attempts on checkboxes
  document.addEventListener('click', (e) => {
    const checkbox = e.target.closest('input[type="checkbox"]');
    if (checkbox && checkbox.disabled) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, true);
  
  // Prevent touch events on disabled checkboxes (mobile protection)
  document.addEventListener('touchstart', (e) => {
    const checkbox = e.target.closest('input[type="checkbox"]');
    if (checkbox && checkbox.disabled) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, { passive: false, capture: true });
  
  // Add resize listener to handle orientation changes
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // Re-initialize canvas sizes for signature boxes
      signatureBoxes.forEach(canvas => {
        resizeCanvasToDisplaySize(canvas);
        setupSignatureContext(canvas.getContext('2d', { willReadFrequently: true }));
      });
      
      // Update UI
      updateProgressBar();
    }, 250);
  });
  
  // Handle visibility change (when user switches tabs or apps)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      // User returned to the page, ensure everything is up to date
      document.querySelectorAll('table').forEach(updateTableStatus);
      updateProgressBar();
    }
  });

  // ===== AI ANALYSIS MODAL HANDLERS =====
  const aiModal = document.getElementById('ai-modal');
  const aiModalContent = document.getElementById('ai-modal-content');
  const aiAnalysisBtn = document.getElementById('ai-analysis-btn');
  const aiModalCloseBtn = document.getElementById('ai-modal-close-btn');
  const aiModalClose = document.getElementById('ai-modal-close');
  const aiCopyBtn = document.getElementById('ai-copy-btn');

  // Show AI Modal
  function showAIModal() {
    aiModal.classList.remove('hidden');
    aiModal.classList.add('flex');
    
    // Generate AI Analysis
    setTimeout(() => {
      const aiReport = generateAIReport();
      displayAIReport(aiReport);
    }, 300);
  }

  // Hide AI Modal
  function hideAIModal() {
    aiModal.classList.add('hidden');
    aiModal.classList.remove('flex');
  }

  // Display AI Report in Modal
  function displayAIReport(report) {
    const html = `
      <div class="space-y-6">
        <!-- Header with emoji -->
        <div class="text-center mb-6 pb-4 border-b-2 border-purple-200">
          <div class="text-4xl mb-2">🤖</div>
          <h3 class="text-2xl font-black text-gray-800">تقرير التحليل الذكي</h3>
          <p class="text-sm text-gray-500 mt-1">${report.date}</p>
        </div>

        <!-- Overall Score -->
        <div class="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border-2 border-purple-200">
          <div class="flex items-center justify-between">
            <span class="text-lg font-bold text-gray-700">التقييم العام:</span>
            <span class="text-3xl font-black ${
              parseFloat(report.overallScore) >= 80 ? 'text-green-600' :
              parseFloat(report.overallScore) >= 60 ? 'text-yellow-600' :
              'text-red-600'
            }">${report.overallScore}</span>
          </div>
        </div>

        <!-- Sections Analysis -->
        <div class="space-y-4">
          <h4 class="text-xl font-black text-gray-800 flex items-center gap-2">
            <span>📊</span>
            <span>تحليل الأقسام</span>
          </h4>
          ${report.sections.map(section => `
            <div class="bg-white border-2 border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div class="flex items-center justify-between mb-3">
                <h5 class="font-bold text-lg text-gray-800">${section.name}</h5>
                <span class="px-3 py-1 rounded-full text-sm font-bold ${
                  parseFloat(section.percentage) >= 80 ? 'bg-green-100 text-green-700' :
                  parseFloat(section.percentage) >= 60 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }">${section.percentage}</span>
              </div>
              
              <div class="space-y-2 text-sm">
                ${section.issues.length > 0 ? `
                  <div class="bg-red-50 border border-red-200 rounded p-3">
                    <p class="font-bold text-red-800 mb-2">⚠️ المشاكل المكتشفة:</p>
                    <ul class="list-disc list-inside space-y-1 text-gray-700">
                      ${section.issues.map(issue => `<li>${issue}</li>`).join('')}
                    </ul>
                  </div>
                ` : `
                  <div class="bg-green-50 border border-green-200 rounded p-3">
                    <p class="font-bold text-green-800">✅ لا توجد مشاكل في هذا القسم</p>
                  </div>
                `}
                
                ${section.insights ? `
                  <div class="bg-blue-50 border border-blue-200 rounded p-3">
                    <p class="font-bold text-blue-800 mb-1">💡 تحليل ذكي:</p>
                    <p class="text-gray-700">${section.insights}</p>
                  </div>
                ` : ''}
                
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Patterns Detection -->
        ${report.patterns && report.patterns.length > 0 ? `
          <div class="space-y-3">
            <h4 class="text-xl font-black text-gray-800 flex items-center gap-2">
              <span>🔍</span>
              <span>الأنماط المكتشفة</span>
            </h4>
            <div class="space-y-2">
              ${report.patterns.map(pattern => `
                <div class="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-lg p-4">
                  <p class="font-bold text-gray-800 mb-2">${pattern.type}</p>
                  <p class="text-gray-700 text-sm">${pattern.description}</p>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Footer -->
        <div class="text-center pt-4 border-t-2 border-gray-200">
          <p class="text-xs text-gray-500">تم إنشاء هذا التقرير بواسطة نظام AI الهجين (Hybrid Model)</p>
          <p class="text-xs text-gray-400 mt-1">يجمع بين التحليل الإحصائي والذكاء الاصطناعي لتقديم رؤى دقيقة</p>
        </div>
      </div>
    `;
    
    aiModalContent.innerHTML = html;
  }

  // Copy AI Report to Clipboard
  function copyAIReport() {
    const content = aiModalContent.innerText;
    navigator.clipboard.writeText(content).then(() => {
      const originalText = aiCopyBtn.innerHTML;
      aiCopyBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        تم النسخ!
      `;
      aiCopyBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
      aiCopyBtn.classList.add('bg-green-600', 'hover:bg-green-700');
      
      setTimeout(() => {
        aiCopyBtn.innerHTML = originalText;
        aiCopyBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
        aiCopyBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('فشل نسخ التقرير');
    });
  }

  // Event Listeners
  if (aiAnalysisBtn) aiAnalysisBtn.addEventListener('click', showAIModal);
  if (aiModalCloseBtn) aiModalCloseBtn.addEventListener('click', hideAIModal);
  if (aiModalClose) aiModalClose.addEventListener('click', hideAIModal);
  if (aiCopyBtn) aiCopyBtn.addEventListener('click', copyAIReport);
  
  // Close modal when clicking outside
  if (aiModal) {
    aiModal.addEventListener('mousedown', (e) => {
      if (e.target === aiModal) hideAIModal();
    });
  }

  // Close modal with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !aiModal.classList.contains('hidden')) {
      hideAIModal();
    }
  });

  // ===== NOTES MODAL HANDLERS =====
  const notesModal = document.getElementById('notesModal');
  const notesModalTextarea = document.getElementById('notesModalTextarea');
  const notesModalLabel = document.getElementById('notesModalLabel');
  const notesCharCount = document.getElementById('notesCharCount');
  const notesModalClose = document.getElementById('notesModalClose');
  const notesCancelBtn = document.getElementById('notesCancelBtn');
  const notesSaveBtn = document.getElementById('notesSaveBtn');
  let currentNotesTextarea = null;

  // Function to show notes modal
  function showNotesModal(textarea) {
    currentNotesTextarea = textarea;
    
    // Ensure modal textarea is not disabled or readonly
    notesModalTextarea.removeAttribute('disabled');
    notesModalTextarea.removeAttribute('readonly');
    notesModalTextarea.value = textarea.value;
    updateCharCount();
    
    // Set label based on which section this textarea belongs to
    const table = textarea.closest('table');
    if (table) {
      const sectionName = table.querySelector('th[colspan]')?.textContent || 'ملاحظات';
      notesModalLabel.textContent = `ملاحظات - ${sectionName}:`;
    } else {
      notesModalLabel.textContent = 'الملاحظات:';
    }
    
    notesModal.classList.remove('hidden');
    notesModal.classList.add('flex');
    
    // Focus on textarea after modal opens with sufficient delay
    setTimeout(() => {
      notesModalTextarea.focus();
      notesModalTextarea.select(); // Select all text for easy replacement
    }, 200);
  }

  // Function to hide notes modal
  function hideNotesModal() {
    notesModal.classList.add('hidden');
    notesModal.classList.remove('flex');
    currentNotesTextarea = null;
  }

  // Function to save notes
  function saveNotes() {
    if (currentNotesTextarea) {
      currentNotesTextarea.value = notesModalTextarea.value;
      
      // Update the print version as well
      const printDiv = currentNotesTextarea.closest('td, div')?.querySelector('.print\\:block');
      if (printDiv) {
        printDiv.textContent = notesModalTextarea.value;
      }
      
      // Trigger change event to update any listeners
      currentNotesTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
    hideNotesModal();
  }

  // Update character count
  function updateCharCount() {
    const count = notesModalTextarea.value.length;
    notesCharCount.textContent = count;
    notesCharCount.style.color = count > 450 ? '#dc2626' : count > 400 ? '#f59e0b' : '#6b7280';
  }

  // Add click listeners to all notes textareas
  function setupNotesTextareas() {
    const notesTextareas = document.querySelectorAll('textarea[maxlength="500"]:not(#notesModalTextarea)');
    
    notesTextareas.forEach(textarea => {
      // Remove readonly attribute if exists
      textarea.removeAttribute('readonly');
      textarea.removeAttribute('disabled');
      
      // Add single click listener
      textarea.addEventListener('click', (e) => {
        showNotesModal(textarea);
      }, { once: false });
      
      // Make cursor pointer to indicate clickability
      textarea.style.cursor = 'pointer';
      textarea.title = 'انقر للتعديل في نافذة أكبر';
    });
  }

  // Setup notes textareas on load
  setupNotesTextareas();

  // Update character count on typing
  if (notesModalTextarea) {
    notesModalTextarea.addEventListener('input', (e) => {
      e.stopPropagation();
      updateCharCount();
    }, false);
  }

  // Event Listeners for Notes Modal
  if (notesModalClose) notesModalClose.addEventListener('click', hideNotesModal);
  if (notesCancelBtn) notesCancelBtn.addEventListener('click', hideNotesModal);
  if (notesSaveBtn) notesSaveBtn.addEventListener('click', saveNotes);

  // Close modal when clicking outside (on the backdrop only)
  if (notesModal) {
    notesModal.addEventListener('mousedown', (e) => {
      // Only close if clicking directly on the backdrop, not on any child elements
      if (e.target === notesModal) {
        hideNotesModal();
      }
    });
  }

  // Ensure textarea is always editable and responsive
  if (notesModalTextarea) {
    notesModalTextarea.addEventListener('keydown', (e) => {
      e.stopPropagation();
      // Handle Ctrl+Enter to save
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        saveNotes();
      }
    }, false);
    
    notesModalTextarea.addEventListener('keypress', (e) => {
      e.stopPropagation();
    }, false);
    
    notesModalTextarea.addEventListener('keyup', (e) => {
      e.stopPropagation();
    }, false);
  }

  // Save with Enter key (Ctrl+Enter or Cmd+Enter)
  if (notesModalTextarea) {
    notesModalTextarea.addEventListener('keydown', (e) => {
      // Stop propagation to prevent any parent handlers
      e.stopPropagation();
      
      // Only handle Ctrl+Enter or Cmd+Enter for saving
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        saveNotes();
      }
      // Allow all other keys for normal typing
    });
  }

  // Close notes modal with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !notesModal.classList.contains('hidden')) {
      hideNotesModal();
    }
  });

  // ===== AUTO-FOCUS NEXT FIELD =====
  // Enable automatic focus to next field when pressing Enter or when field is completed
  function setupAutoFocusFields() {
    // Get all focusable input fields (text inputs, date inputs, selects)
    const focusableFields = document.querySelectorAll('input[type="text"], input[type="date"], select:not(.print\\:hidden)');
    
    focusableFields.forEach((field, index) => {
      // Add Enter key listener to move to next field
      field.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          
          // Find next focusable field
          let nextIndex = index + 1;
          while (nextIndex < focusableFields.length) {
            const nextField = focusableFields[nextIndex];
            
            // Skip disabled or hidden fields
            if (!nextField.disabled && !nextField.hidden && nextField.offsetParent !== null) {
              nextField.focus();
              
              // If it's a select, open it
              if (nextField.tagName === 'SELECT') {
                nextField.click();
              }
              break;
            }
            nextIndex++;
          }
        }
      });
      
      // For date inputs, auto-move when date is selected
      if (field.type === 'date') {
        field.addEventListener('change', () => {
          if (field.value) {
            // Small delay to ensure change is registered
            setTimeout(() => {
              let nextIndex = index + 1;
              while (nextIndex < focusableFields.length) {
                const nextField = focusableFields[nextIndex];
                if (!nextField.disabled && !nextField.hidden && nextField.offsetParent !== null) {
                  nextField.focus();
                  break;
                }
                nextIndex++;
              }
            }, 100);
          }
        });
      }
      
      // For selects, auto-move after selection
      if (field.tagName === 'SELECT') {
        field.addEventListener('change', () => {
          if (field.value) {
            setTimeout(() => {
              let nextIndex = index + 1;
              while (nextIndex < focusableFields.length) {
                const nextField = focusableFields[nextIndex];
                if (!nextField.disabled && !nextField.hidden && nextField.offsetParent !== null) {
                  nextField.focus();
                  if (nextField.tagName === 'SELECT') {
                    nextField.click();
                  }
                  break;
                }
                nextIndex++;
              }
            }, 100);
          }
        });
      }
    });
    
    // Add Tab key support (natural browser behavior, but ensure consistency)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        // Let browser handle Tab naturally, just ensure it works with our fields
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT')) {
          // Browser's default Tab behavior will work
        }
      }
    });
  }

  // Setup auto-focus on page load
  setupAutoFocusFields();

  // ===== VISUAL FEEDBACK FOR FIELD COMPLETION =====
  function setupFieldValidationFeedback() {
    // Get all input fields
    const allInputs = document.querySelectorAll('input[type="text"], input[type="date"]');
    const allSelects = document.querySelectorAll('select:not(.print\\:hidden)');
    
    // Add validation feedback for text and date inputs
    allInputs.forEach(input => {
      input.addEventListener('input', () => {
        updateFieldVisualState(input);
      });
      
      input.addEventListener('blur', () => {
        updateFieldVisualState(input);
      });
      
      // Initial state
      updateFieldVisualState(input);
    });
    
    // Add validation feedback for selects
    allSelects.forEach(select => {
      select.addEventListener('change', () => {
        updateSelectVisualState(select);
        
        // Also update the row completion
        const row = select.closest('tr');
        if (row) {
          checkRowCompletion(row);
        }
      });
      
      // Initial state
      updateSelectVisualState(select);
    });
    
    // Add checkbox change listeners
    const allCheckboxes = document.querySelectorAll('input[type="checkbox"]:not(:disabled)');
    allCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        const row = checkbox.closest('tr');
        if (row) {
          checkRowCompletion(row);
        }
      });
    });
  }
  
  function updateFieldVisualState(input) {
    if (input.value && input.value.trim() !== '') {
      input.classList.remove('field-empty');
      input.classList.add('field-filled');
    } else {
      input.classList.add('field-empty');
      input.classList.remove('field-filled');
    }
  }
  
  function updateSelectVisualState(select) {
    if (select.value && select.value !== '') {
      select.classList.remove('field-empty');
      select.classList.add('field-filled');
      select.style.fontWeight = '700';
      select.style.color = '#1f2937';
    } else {
      select.classList.add('field-empty');
      select.classList.remove('field-filled');
      select.style.fontWeight = '600';
      select.style.color = '#9ca3af';
    }
  }
  
  function checkRowCompletion(row) {
    const checkboxes = row.querySelectorAll('input[type="checkbox"]:not(:disabled)');
    const select = row.querySelector('select');
    
    let isComplete = false;
    
    // Check if at least one checkbox is checked
    const hasCheckedBox = Array.from(checkboxes).some(cb => cb.checked);
    
    // Check if select has value
    const hasSelectValue = select && select.value && select.value !== '';
    
    isComplete = hasCheckedBox && hasSelectValue;
    
    if (isComplete) {
      row.style.backgroundColor = '#f0fdf4';
      row.style.borderLeft = '4px solid #22c55e';
    } else {
      row.style.backgroundColor = '';
      row.style.borderLeft = '';
    }
  }
  
  // Setup validation feedback
  setupFieldValidationFeedback();
  
  // Add visual indicator for current section
  function highlightCurrentSection() {
    const sections = document.querySelectorAll('table');
    
    sections.forEach(section => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            section.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.3)';
            section.style.transition = 'box-shadow 0.3s ease-in-out';
          } else {
            section.style.boxShadow = '';
          }
        });
      }, {
        threshold: 0.5
      });
      
      observer.observe(section);
    });
  }
  
  // Enable section highlighting
  if (window.IntersectionObserver) {
    highlightCurrentSection();
  }
  
  // Add scroll-to-empty-field function
  function scrollToFirstEmptyField() {
    const emptyFields = document.querySelectorAll('input[type="text"]:placeholder-shown, input[type="date"]:invalid, select:not([value])');
    
    if (emptyFields.length > 0) {
      const firstEmpty = emptyFields[0];
      firstEmpty.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        firstEmpty.focus();
      }, 500);
    }
  }
  
  // Add keyboard shortcut Ctrl+Shift+F to find first empty field
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      scrollToFirstEmptyField();
      showToast('الانتقال إلى أول حقل فارغ', 'info');
    }
  });

  // ===== INPUT VALIDATION & FORMATTING =====
  // التحقق من صحة حقول الإدخال وتنسيقها مع الانتقال التلقائي
  
  function setupInputValidation() {
    const headerGrid = document.querySelector('.mb-6.print\\:mb-2.border.border-black.bg-black');
    if (!headerGrid) return;
    
    const inputs = headerGrid.querySelectorAll('input[type="text"]');
    const inputsArray = Array.from(inputs);
    
    // دالة للانتقال للحقل التالي
    function moveToNextField(currentInput) {
      const currentIndex = inputsArray.indexOf(currentInput);
      if (currentIndex >= 0 && currentIndex < inputsArray.length - 1) {
        inputsArray[currentIndex + 1].focus();
      }
    }
    
    // دالة للانتقال للحقل السابق
    function moveToPrevField(currentInput) {
      const currentIndex = inputsArray.indexOf(currentInput);
      if (currentIndex > 0) {
        inputsArray[currentIndex - 1].focus();
      }
    }
    
    // تحديد الحقول حسب التسميات
    inputs.forEach((input, index) => {
      const parent = input.closest('.flex.bg-white');
      if (!parent) return;
      
      const labelDiv = parent.querySelector('.bg-gray-100');
      if (!labelDiv) return;
      
      const labelText = labelDiv.textContent.trim();
      
      // رقم اللوحة - صيغة خاصة: 3 حروف مع مسافات + 4 أرقام
      if (labelText === 'رقم اللوحة') {
        input.setAttribute('data-field', 'plate-number');
        input.setAttribute('placeholder', 'ا د ط 8955');
        input.setAttribute('dir', 'rtl');
        input.setAttribute('maxlength', '12'); // 3 حروف + 3 مسافات + 4 أرقام + مسافة = 11-12
        
        input.addEventListener('input', function(e) {
          let value = e.target.value;
          
          // إزالة كل المسافات أولاً للمعالجة
          let cleanValue = value.replace(/\s/g, '');
          
          // السماح بالحروف العربية والإنجليزية والأرقام فقط
          cleanValue = cleanValue.replace(/[^\u0600-\u06FFa-zA-Z0-9٠-٩]/g, '');
          
          // تحويل الحروف الإنجليزية لأحرف كبيرة
          cleanValue = cleanValue.toUpperCase();
          
          // فصل الحروف عن الأرقام
          let letters = '';
          let numbers = '';
          
          for (let char of cleanValue) {
            if (/[\u0600-\u06FFa-zA-Z]/.test(char)) {
              if (letters.length < 3) { // حد أقصى 3 حروف
                letters += char;
              }
            } else if (/[0-9٠-٩]/.test(char)) {
              if (numbers.length < 4) { // حد أقصى 4 أرقام
                numbers += char;
              }
            }
          }
          
          // تحويل الأرقام العربية إلى إنجليزية
          numbers = convertArabicNumbers(numbers);
          
          // تنسيق النتيجة: إضافة مسافات بين الحروف
          let formatted = '';
          for (let i = 0; i < letters.length; i++) {
            formatted += letters[i];
            if (i < letters.length - 1) {
              formatted += ' ';
            }
          }
          
          // إضافة الأرقام
          if (numbers) {
            formatted += ' ' + numbers;
          }
          
          e.target.value = formatted;
          
          // الانتقال للحقل التالي عند اكتمال رقم اللوحة (3 حروف + 4 أرقام)
          if (letters.length === 3 && numbers.length === 4) {
            moveToNextField(input);
          }
        });
        
        input.addEventListener('blur', function(e) {
          const value = e.target.value.trim();
          if (value && !validatePlateNumber(value)) {
            showToast('صيغة رقم اللوحة غير صحيحة. يجب أن تحتوي على 3 حروف و 4 أرقام. مثال: ا د ط 8955', 'error');
            input.classList.add('ring-2', 'ring-red-500');
            setTimeout(() => input.classList.remove('ring-2', 'ring-red-500'), 3000);
          }
        });
        
        // دعم مفتاح Backspace للانتقال للحقل السابق
        input.addEventListener('keydown', function(e) {
          if (e.key === 'Backspace' && e.target.value === '') {
            moveToPrevField(input);
          }
          if (e.key === 'Enter') {
            moveToNextField(input);
          }
        });
      }
      
      // رقم التشغيل - أرقام فقط مع انتقال تلقائي
      if (labelText === 'رقم التشغيل') {
        input.setAttribute('data-field', 'operation-number');
        input.setAttribute('placeholder', 'أرقام فقط');
        input.setAttribute('inputmode', 'numeric');
        input.setAttribute('pattern', '[0-9٠-٩]*');
        input.setAttribute('maxlength', '10');
        
        input.addEventListener('input', function(e) {
          let value = e.target.value;
          value = value.replace(/[^0-9٠-٩]/g, '');
          value = convertArabicNumbers(value);
          e.target.value = value;
          
          // الانتقال للحقل التالي عند الوصول للحد الأقصى
          if (value.length >= 10) {
            moveToNextField(input);
          }
        });
        
        input.addEventListener('keydown', function(e) {
          if (e.key === 'Backspace' && e.target.value === '') {
            moveToPrevField(input);
          }
          if (e.key === 'Enter') {
            moveToNextField(input);
          }
        });
      }
      
      // عدد المقاعد - أرقام فقط مع انتقال تلقائي
      if (labelText === 'عدد المقاعد') {
        input.setAttribute('data-field', 'seats-count');
        input.setAttribute('placeholder', 'أرقام فقط');
        input.setAttribute('inputmode', 'numeric');
        input.setAttribute('pattern', '[0-9٠-٩]*');
        input.setAttribute('maxlength', '3'); // حد أقصى 3 أرقام (مثل 100)
        
        input.addEventListener('input', function(e) {
          let value = e.target.value;
          value = value.replace(/[^0-9٠-٩]/g, '');
          value = convertArabicNumbers(value);
          e.target.value = value;
          
          // الانتقال للحقل التالي عند الوصول للحد الأقصى
          if (value.length >= 3) {
            moveToNextField(input);
          }
        });
        
        input.addEventListener('blur', function(e) {
          const value = parseInt(e.target.value);
          if (value && (value < 1 || value > 100)) {
            showToast('عدد المقاعد يجب أن يكون بين 1 و 100', 'error');
          }
        });
        
        input.addEventListener('keydown', function(e) {
          if (e.key === 'Backspace' && e.target.value === '') {
            moveToPrevField(input);
          }
          if (e.key === 'Enter') {
            moveToNextField(input);
          }
        });
      }
      
      // عدد الكيلومتر - أرقام فقط مع انتقال تلقائي
      if (labelText === 'عدد الكيلومتر') {
        input.setAttribute('data-field', 'kilometers');
        input.setAttribute('placeholder', 'أرقام فقط');
        input.setAttribute('inputmode', 'numeric');
        input.setAttribute('pattern', '[0-9٠-٩]*');
        input.setAttribute('maxlength', '7'); // حد أقصى 7 أرقام (مثل 9999999)
        
        input.addEventListener('input', function(e) {
          let value = e.target.value;
          value = value.replace(/[^0-9٠-٩]/g, '');
          value = convertArabicNumbers(value);
          e.target.value = value;
          
          // الانتقال للحقل التالي عند الوصول للحد الأقصى
          if (value.length >= 7) {
            moveToNextField(input);
          }
        });
        
        input.addEventListener('keydown', function(e) {
          if (e.key === 'Backspace' && e.target.value === '') {
            moveToPrevField(input);
          }
          if (e.key === 'Enter') {
            moveToNextField(input);
          }
        });
      }
    });
  }
  
  // تحويل الأرقام العربية إلى إنجليزية
  function convertArabicNumbers(str) {
    const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    for (let i = 0; i < 10; i++) {
      str = str.replace(new RegExp(arabicNums[i], 'g'), i);
    }
    return str;
  }
  
  // التحقق من صيغة رقم اللوحة
  function validatePlateNumber(value) {
    // الصيغة المتوقعة: 3 حروف مع مسافات بينها + مسافة + 4 أرقام
    // مثال: ا د ط 8955 أو A B C 8955
    const platePattern = /^[\u0600-\u06FFa-zA-Z]\s[\u0600-\u06FFa-zA-Z]\s[\u0600-\u06FFa-zA-Z]\s[0-9]{4}$/;
    return platePattern.test(value.trim());
  }
  
  // تهيئة التحقق من الحقول
  setupInputValidation();
});
