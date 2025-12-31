// Initialize jsPDF
window.jsPDF = window.jspdf.jsPDF;

document.addEventListener('DOMContentLoaded', function () {
  // DOM Elements
  const printBtn = document.querySelector('button[title="طباعة"]');
  const pdfBtn = document.querySelector('button[title="تصدير PDF"]');
  const dataBtn = document.querySelector('button[title="بيانات تجريبية"]');
  const clearBtn = document.querySelector('button[title="مسح"]');
  const modal = document.getElementById('busDiagramModal');
  const modalImg = document.getElementById('modalDiagramImg');
  const diagramContainer = document.getElementById('diagramContainer');
  const closeModalBtn = document.getElementById('closeModalBtn');

  // Button Events
  function validateFullForm() {
    const isMobile = window.matchMedia('(max-width: 1023px)').matches;
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
    
    window.print();
  }));
  if (pdfBtn) pdfBtn.addEventListener('click', () => validateAndAction(exportToPDF));
  if (dataBtn) dataBtn.addEventListener('click', fillTestData);
  if (clearBtn) clearBtn.addEventListener('click', clearForm);

  // Signature Screen (open on click)
  const signatureModal = document.getElementById('signatureModal');
  const signatureModalCanvas = document.getElementById('signatureModalCanvas');
  const signatureCloseBtn = document.getElementById('signatureCloseBtn');
  const signatureClearBtn = document.getElementById('signatureClearBtn');
  const signatureSaveBtn = document.getElementById('signatureSaveBtn');

  const SIGNATURE_LINE_WIDTH = 3.5;
  // Increase resolution scale to 3x for ultra-sharp rendering
  const CANVAS_SCALE = Math.max(window.devicePixelRatio || 1, 3);

  const signatureBoxes = Array.from(document.querySelectorAll('canvas[title="انقر هنا للتوقيع"]'));
  let activeSignatureBox = null;
  let signatureBaseImage = null; // snapshot of existing signature when opening modal

  function setupSignatureContext(ctx) {
    ctx.strokeStyle = '#000';
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
      const sctx = snapshot.getContext('2d');
      sctx.drawImage(canvas, 0, 0);

      // Resize
      canvas.width = displayWidth;
      canvas.height = displayHeight;

      // Restore content
      const ctx = canvas.getContext('2d');
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
    setupSignatureContext(canvas.getContext('2d'));
  });

  function openSignatureModalFor(canvas) {
    if (!signatureModal || !signatureModalCanvas) return;
    activeSignatureBox = canvas;
    signatureModal.classList.remove('hidden');

    // Use setTimeout to ensure the modal is fully rendered and has dimensions
    setTimeout(() => {
      resizeCanvasToDisplaySize(signatureModalCanvas);

      const ctx = signatureModalCanvas.getContext('2d');
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
    const ctx = signatureModalCanvas.getContext('2d');
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

  if (signatureClearBtn && signatureModalCanvas) {
    signatureClearBtn.addEventListener('click', () => {
      const ctx = signatureModalCanvas.getContext('2d');
      ctx.clearRect(0, 0, signatureModalCanvas.width, signatureModalCanvas.height);
      signatureBaseImage = null;
    });
  }

  if (signatureSaveBtn && signatureModalCanvas) {
    signatureSaveBtn.addEventListener('click', () => {
      if (!activeSignatureBox) return closeSignatureModal();
      
      // Ensure the destination canvas is also set up for high quality
      const destCtx = activeSignatureBox.getContext('2d');
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
    });
  }

  // Delete Signature
  document.querySelectorAll('button').forEach(btn => {
    if (btn.textContent.trim() === 'حذف التوقيع') {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const canvas = this.closest('.flex-col').querySelector('canvas');
        if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      });
    }
  });

  // PDF Export
  async function exportToPDF() {
    try {
      const el = document.querySelector('.form-container');
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#fff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jspdf.jsPDF('p', 'mm', 'a4');
      const w = 210;
      const h = canvas.height * w / canvas.width;
      let heightLeft = h;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, w, h);
      heightLeft -= 297;
      while (heightLeft >= 0) {
        position = heightLeft - h;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, w, h);
        heightLeft -= 297;
      }
      pdf.save('نموذج_فحص_حافلة.pdf');
      showToast('تم التصدير بنجاح!', 'success');
    } catch (e) {
      showToast('خطأ في التصدير.', 'error');
    }
  }

  // Fill Test Data
  function fillTestData() {
    const inputs = document.querySelectorAll('input[type="text"]');
    if (inputs.length >= 5) {
      inputs[0].value = "أ ب ج 1234";
      inputs[1].value = "OPR-2025-001";
      inputs[2].value = "45";
      inputs[3].value = "مدرسة النور";
      inputs[4].value = "125,430";
    }
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(i => i.value = today);
    
    // Fill test evaluations via dropdown (not checkboxes)
    document.querySelectorAll('table tbody tr').forEach((row, i) => {
      if (row.querySelector('.percent-badge')) return; // Skip percentage row
      
      const select = row.querySelector('select');
      if (select && select.options.length > 1) {
        // Randomly pick a value (weighted towards good options)
        const rand = Math.random();
        if (rand > 0.7) {
          select.selectedIndex = 1; // First option (usually best)
        } else if (rand > 0.4) {
          select.selectedIndex = 2; // Second option (usually good)
        } else if (rand > 0.2) {
          select.selectedIndex = 3; // Third option (usually medium)
        } else {
          select.selectedIndex = Math.min(4, select.options.length - 1);
        }
        // Trigger change event to update checkboxes automatically
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    
    // Fill mobile card selects
    document.querySelectorAll('.lg\\:hidden select').forEach((select, i) => {
      if (select.options.length > 1) {
        const rand = Math.random();
        if (rand > 0.7) {
          select.selectedIndex = 1;
        } else if (rand > 0.4) {
          select.selectedIndex = 2;
        } else if (rand > 0.2) {
          select.selectedIndex = 3;
        } else {
          select.selectedIndex = Math.min(4, select.options.length - 1);
        }
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    
    const nameInputs = document.querySelectorAll('input[placeholder*="الاسم"]');
    if (nameInputs.length >= 3) {
      nameInputs[0].value = "أحمد علي";
      nameInputs[1].value = "خالد سعيد";
      nameInputs[2].value = "فهد محمد";
    }
    
    setTimeout(() => {
      document.querySelectorAll('table').forEach(updateTableStatus);
      showToast('تم تعبئة البيانات!', 'success');
    }, 100);
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
    document.querySelectorAll('canvas').forEach(c => c.getContext('2d').clearRect(0, 0, c.width, c.height));
    document.querySelectorAll('.percent-badge').forEach(b => { b.value = '0%'; b.style.color = '#dc2626'; });
    damageMarkers = []; renderPrintMarkers(); 
    document.querySelectorAll('table').forEach(updateTableStatus);
    showToast('تم المسح!', 'info');
  }

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
    'متوسطة', 'تحتاج تنظيف', 'يحتاج تنبيه'
  ];

  const PERFECT_OPTIONS = [
    'ممتازة', 'سليمة', 'جديدة', 'موجودة وتعمل', 'يعمل بكفاءة', 
    'مكتملة وسارية', 'موجودة وواضحة', 'نظيفة وسليمة', 'مكتملة وسليمة', 
    'يعمل', 'ملتزم تماماً', 'لائق ومطابق للتعليمات', 'ممتاز', 
    'ملتزم', 'مواظب', 'يبلغ ويتابع', 'سليم'
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
           // Disable manual checkbox interaction
           inputs.pass.style.pointerEvents = 'none';
           inputs.pass.style.opacity = '0.6';
           inputs.pass.style.cursor = 'not-allowed';
           inputs.fail.style.pointerEvents = 'none';
           inputs.fail.style.opacity = '0.6';
           inputs.fail.style.cursor = 'not-allowed';
           
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

  function getEvaluationScore(text) {
    if (!text) return 0;
    
    const scoreMap = [
      { score: 100, pattern: /ممتاز|سليم|جديد|يعمل بكفاءة|مكتملة وسارية|موجودة وواضحة|نظيفة وسليمة|مكتملة وسليمة|ملتزم تماماً|لائق|مواظب$|يبلغ ويتابع|يعمل$/ },
      { score: 80, pattern: /جيد|ملاحظة بسيطة|خدوش بسيطة|شرخ بسيط|مكتملة مع ملاحظات|ملتزم غالباً|يبلغ فقط|مواظب غالباً/ },
      { score: 60, pattern: /متوسط|مقبول|يعمل جزئياً|موجودة وباهتة|فعالة جزئياً|يعمل أحياناً|تأخير بسيط|يحتاج تنبيه|ملتزم مع ملاحظات|مكتملة وقريبة/ },
      { score: 40, pattern: /تحتاج صيانة|عطل جزئي|ضعيف|تالفة جزئياً|أضرار متوسطة|كسر جزئي|موجودة ولا تعمل|ناقصة|تحتاج تنظيف|تحتاج إعادة برمجة|يتأخر|غير منتظم|مخالف أحياناً|تأخير متكرر/ },
      { score: 20, pattern: /متوقفة|عطل كامل|تحتاج فحص|تحتاج شحن|تحتاج استبدال|أضرار جسيمة|يحتاج إصلاح|كسر كامل|تالفة|غير موجود|منتهية|تحتاج تحديث|سيئة|مهملة|نادراً|لا يقوم|لا يتابع|لا يبلغ|غير متعاون|مخالف|غير ملتزم|غير لائق/ }
    ];
    
    const match = scoreMap.find(item => text.match(item.pattern));
    return match ? match.score : 0;
  }

  function updateTableStatus(table) {
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    let totalScore = 0;
    let count = 0;
    let totalItems = 0;
    let passedCount = 0;
    let issues = [];
    
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

      totalItems++;
      
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

      // Scoring Logic
      if (passCb.checked || failCb.checked) {
         let passScore = passCb.checked ? 100 : 0;
         let evalScore = 0;
         
         if (select && select.value) {
            evalScore = getEvaluationScore(select.value);
         } else {
            evalScore = passCb.checked ? 100 : 0;
         }

         const itemScore = (passScore + evalScore) / 2;
         totalScore += itemScore;
         count++;
      }
    });

    // Special logic for specific sections
    let finalPercent = 0;
    const defaultPercent = totalItems > 0 ? Math.round(totalScore / totalItems) : 0;
    
    if (sectionName === 'حوادث وتأمين') {
      // For Accidents section: Check if "الهيكل الخارجي" has damage
      const bodyDamageRow = rows.find(row => row.cells[0]?.innerText.trim() === 'الهيكل الخارجي');
      const hasBodyDamage = bodyDamageRow && bodyDamageRow.querySelectorAll('input[type="checkbox"]')[1]?.checked;
      
      // If no body damage and all items complete, give 100%
      finalPercent = (!hasBodyDamage && count === totalItems && totalItems > 0) ? 100 : defaultPercent;
      
    } else if (sectionName === 'السائق') {
      // For Driver section: If all items complete and matching, give 100%
      const allPerfect = count === totalItems && totalItems > 0 && rows.every(row => {
        if (row.querySelector('.percent-badge')) return true;
        const checkboxes = row.querySelectorAll('input[type="checkbox"]');
        if (checkboxes.length < 2) return true;
        
        const passCb = checkboxes[0];
        const select = row.querySelector('select');
        
        return passCb.checked && (!select?.value || PERFECT_OPTIONS.includes(select.value));
      });
      
      finalPercent = allPerfect ? 100 : defaultPercent;
      
    } else {
      finalPercent = defaultPercent;
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

    // Smart Notes
    const textarea = table.querySelector('textarea');
    if (textarea) {
      if (issues.length > 0) {
        textarea.value = "الملاحظات:\n" + issues.join("\n");
      } else if (passedCount === totalItems && totalItems > 0) {
        textarea.value = "جميع البنود سليمة.";
      } else {
        textarea.value = "";
      }
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
               const ctx = sigCanvases[item.index].getContext('2d');
               ctx.drawImage(img, 0, 0);
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
  
  // Add resize listener to handle orientation changes
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // Re-initialize canvas sizes for signature boxes
      signatureBoxes.forEach(canvas => {
        resizeCanvasToDisplaySize(canvas);
        setupSignatureContext(canvas.getContext('2d'));
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
});
