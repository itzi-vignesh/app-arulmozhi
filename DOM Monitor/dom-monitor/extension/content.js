// Content Script for element selection and hover highlighting
(function () {
  let isSelecting = false;
  let overlay = null;
  let recordedInteractions = [];
  let lastClickedElement = null;

  // 1. Selector Generator Engine
  // 1. Selector Generator Engine
  function generateSelector(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return "";

    const stableAttrs = ["data-id", "name", "data-testid", "data-qa", "data-test", "role"];
    let strategy = "";
    let finalSelector = "";

    // 1. Log whether element.closest("table") returns a table
    const tableEl = element.closest("table");
    console.log("[Selector Generator] element.closest('table') returns a table:", !!tableEl);
    
    // 2. Log the table classes
    if (tableEl) {
      console.log("[Selector Generator] Table classes:", tableEl.className || "(none)");
    }

    // A. Unique ID priority
    if (!finalSelector && element.id) {
      const id = element.id.trim();
      try {
        if (document.querySelectorAll(`#${CSS.escape(id)}`).length === 1) {
          finalSelector = `#${id}`;
          strategy = "ID";
        }
      } catch (e) {}
    }

    // B. Stable attributes priority
    if (!finalSelector) {
      for (let i = 0; i < stableAttrs.length; i++) {
        const attr = stableAttrs[i];
        if (element.hasAttribute(attr)) {
          const val = element.getAttribute(attr);
          if (val) {
            const attrSelector = `[${attr}="${CSS.escape(val)}"]`;
            try {
              if (document.querySelectorAll(attrSelector).length === 1) {
                finalSelector = attrSelector;
                strategy = "Stable Attribute";
                break;
              }
            } catch (e) {}
          }
        }
      }
    }
    // Try other data-* attributes
    if (!finalSelector && element.attributes) {
      for (let i = 0; i < element.attributes.length; i++) {
        const attrName = element.attributes[i].name;
        if (attrName.startsWith("data-") && !stableAttrs.includes(attrName)) {
          const val = element.attributes[i].value;
          if (val) {
            const attrSelector = `[${attrName}="${CSS.escape(val)}"]`;
            try {
              if (document.querySelectorAll(attrSelector).length === 1) {
                finalSelector = attrSelector;
                strategy = "Stable Attribute";
                break;
              }
            } catch (e) {}
          }
        }
      }
    }

    // C. Unique Class priority (including combinations)
    if (!finalSelector && element.classList && element.classList.length > 0) {
      // Try single classes first
      for (let i = 0; i < element.classList.length; i++) {
        const className = element.classList[i].trim();
        if (!className || className.includes(":") || className.includes(" ")) continue;
        try {
          if (document.querySelectorAll(`.${CSS.escape(className)}`).length === 1) {
            finalSelector = `.${className}`;
            strategy = "Class Combination";
            break;
          }
        } catch (e) {}
      }
      // Try combinations of all valid classes
      if (!finalSelector) {
        const validClasses = [];
        for (let i = 0; i < element.classList.length; i++) {
          const className = element.classList[i].trim();
          if (className && !className.includes(":") && !className.includes(" ")) {
            validClasses.push(CSS.escape(className));
          }
        }
        if (validClasses.length > 1) {
          const combinationSelector = `.${validClasses.join(".")}`;
          try {
            if (document.querySelectorAll(combinationSelector).length === 1) {
              finalSelector = combinationSelector;
              strategy = "Class Combination";
            }
          } catch (e) {}
        }
      }
    }

    // D. Table-Relative Selector Scoping
    // If a table ancestor exists, force table-relative generation before entering the fallback nth-child path builder
    if (!finalSelector && tableEl) {
      const tableSelector = getUniqueTableSelector(tableEl);
      const relativePath = [];
      let current = element;
      while (current && current !== tableEl) {
        let part = current.nodeName.toLowerCase();
        let sibling = current;
        let index = 1;
        while (sibling.previousElementSibling) {
          sibling = sibling.previousElementSibling;
          index++;
        }
        part += `:nth-child(${index})`;
        relativePath.unshift(part);
        current = current.parentNode;
      }
      if (relativePath.length > 0) {
        finalSelector = tableSelector + " " + relativePath.join(" > ");
      } else {
        finalSelector = tableSelector;
      }
      strategy = "Table Relative";
    }

    // E. Generated Fallback Climber (with descendant optimizations)
    if (!finalSelector) {
      finalSelector = generateFallbackSelector(element, false);
      strategy = "Fallback Path";
    }

    console.log(`[Selector Generator] Selected strategy: ${strategy}`);
    console.log(`[Selector Generator] Final selector: ${finalSelector}`);

    return finalSelector;

    // Helper for table unique selector
    function getUniqueTableSelector(tbl) {
      if (tbl.id) {
        return `table#${tbl.id}`;
      }
      
      // Try Stable Attributes
      for (let i = 0; i < stableAttrs.length; i++) {
        const attr = stableAttrs[i];
        if (tbl.hasAttribute(attr)) {
          const val = tbl.getAttribute(attr);
          if (val) {
            const sel = `table[${attr}="${CSS.escape(val)}"]`;
            if (document.querySelectorAll(sel).length === 1) {
              return sel;
            }
          }
        }
      }

      // Try Classes
      let tableSel = "table";
      if (tbl.classList && tbl.classList.length > 0) {
        const classes = [];
        for (let i = 0; i < tbl.classList.length; i++) {
          const cls = tbl.classList[i].trim();
          if (cls) classes.push(CSS.escape(cls));
        }
        if (classes.length > 0) {
          const sel = `table.${classes.join(".")}`;
          if (document.querySelectorAll(sel).length === 1) {
            return sel;
          }
          tableSel = sel;
        }
      }

      // Try unique ancestor scoper for class-based table selector to avoid nth-child climber
      let ancestor = tbl.parentNode;
      while (ancestor && ancestor.nodeType === Node.ELEMENT_NODE) {
        // Try ancestor ID
        if (ancestor.id) {
          const id = ancestor.id.trim();
          const sel = `#${CSS.escape(id)} ${tableSel}`;
          if (document.querySelectorAll(sel).length === 1) {
            return sel;
          }
        }
        // Try ancestor stable attributes
        for (let i = 0; i < stableAttrs.length; i++) {
          const attr = stableAttrs[i];
          if (ancestor.hasAttribute(attr)) {
            const val = ancestor.getAttribute(attr);
            if (val) {
              const sel = `[${attr}="${CSS.escape(val)}"] ${tableSel}`;
              if (document.querySelectorAll(sel).length === 1) {
                return sel;
              }
            }
          }
        }
        // Try ancestor unique class combination
        if (ancestor.classList && ancestor.classList.length > 0) {
          const validClasses = [];
          for (let i = 0; i < ancestor.classList.length; i++) {
            const className = ancestor.classList[i].trim();
            if (className && !className.includes(":") && !className.includes(" ")) {
              validClasses.push(CSS.escape(className));
            }
          }
          if (validClasses.length > 0) {
            const sel = `.${validClasses.join(".")} ${tableSel}`;
            if (document.querySelectorAll(sel).length === 1) {
              return sel;
            }
          }
        }
        ancestor = ancestor.parentNode;
      }

      // If still not unique, find its index among all table elements on the page
      const allTables = document.querySelectorAll("table");
      for (let i = 0; i < allTables.length; i++) {
        if (allTables[i] === tbl) {
          return `table:nth-of-type(${i + 1})`;
        }
      }

      return "table";
    }

    function generateFallbackSelector(el, isTable) {
      // Find the closest ancestor that is uniquely identifiable
      let current = el.parentNode;
      let uniqueAncestorSelector = "";
      while (current && current.nodeType === Node.ELEMENT_NODE) {
        if (current.id) {
          uniqueAncestorSelector = `#${current.id}`;
          break;
        }
        
        let foundUniqueAncestor = false;
        for (let i = 0; i < stableAttrs.length; i++) {
          const attr = stableAttrs[i];
          if (current.hasAttribute(attr)) {
            const val = current.getAttribute(attr);
            if (val) {
              const attrSelector = `[${attr}="${CSS.escape(val)}"]`;
              try {
                if (document.querySelectorAll(attrSelector).length === 1) {
                  uniqueAncestorSelector = attrSelector;
                  foundUniqueAncestor = true;
                  break;
                }
              } catch (e) {}
            }
          }
        }
        if (foundUniqueAncestor) break;

        let foundUniqueClassComb = false;
        if (current.classList && current.classList.length > 0) {
          const validClasses = [];
          for (let i = 0; i < current.classList.length; i++) {
            const className = current.classList[i].trim();
            if (className && !className.includes(":") && !className.includes(" ")) {
              validClasses.push(CSS.escape(className));
            }
          }
          if (validClasses.length > 0) {
            const combinationSelector = `.${validClasses.join(".")}`;
            try {
              if (document.querySelectorAll(combinationSelector).length === 1) {
                uniqueAncestorSelector = combinationSelector;
                foundUniqueClassComb = true;
                break;
              }
            } catch (e) {}
          }
        }
        if (foundUniqueClassComb) break;

        current = current.parentNode;
      }

      // Descendant Shortcut Optimization (to avoid intermediate div:nth-child chains)
      if (uniqueAncestorSelector && !isTable) {
        let targetSelector = el.nodeName.toLowerCase();
        if (el.classList && el.classList.length > 0) {
          const validClasses = [];
          for (let i = 0; i < el.classList.length; i++) {
            const className = el.classList[i].trim();
            if (className && !className.includes(":") && !className.includes(" ")) {
              validClasses.push(CSS.escape(className));
            }
          }
          if (validClasses.length > 0) {
            targetSelector += `.${validClasses.join(".")}`;
          }
        }

        // Candidate 1: ancestor descendant target (e.g. #container span.price)
        let candidate1 = `${uniqueAncestorSelector} ${targetSelector}`;
        try {
          if (document.querySelectorAll(candidate1).length === 1) {
            return candidate1;
          }
        } catch (e) {}

        // Candidate 2: ancestor descendant parent > target (e.g. #container > div.row > span.price)
        const parent = el.parentNode;
        if (parent && parent !== current && parent.classList && parent.classList.length > 0) {
          const parentClasses = [];
          for (let i = 0; i < parent.classList.length; i++) {
            const className = parent.classList[i].trim();
            if (className && !className.includes(":") && !className.includes(" ")) {
              parentClasses.push(CSS.escape(className));
            }
          }
          if (parentClasses.length > 0) {
            let parentPart = parent.nodeName.toLowerCase() + `.${parentClasses.join(".")}`;
            let candidate2 = `${uniqueAncestorSelector} ${parentPart} > ${targetSelector}`;
            try {
              if (document.querySelectorAll(candidate2).length === 1) {
                return candidate2;
              }
            } catch (e) {}
          }
        }
      }

      // Default Child Climbing fallback (stop at uniqueAncestorSelector if it exists)
      const path = [];
      let curr = el;
      while (curr && curr.nodeType === Node.ELEMENT_NODE) {
        let selector = curr.nodeName.toLowerCase();
        
        if (uniqueAncestorSelector && curr !== el) {
          if (curr.id && `#${curr.id}` === uniqueAncestorSelector) {
            path.unshift(uniqueAncestorSelector);
            break;
          }
          let matched = false;
          for (let i = 0; i < stableAttrs.length; i++) {
            const attr = stableAttrs[i];
            if (curr.hasAttribute(attr)) {
              const val = curr.getAttribute(attr);
              if (val && `[${attr}="${CSS.escape(val)}"]` === uniqueAncestorSelector) {
                path.unshift(uniqueAncestorSelector);
                matched = true;
                break;
              }
            }
          }
          if (matched) break;

          if (curr.classList && curr.classList.length > 0) {
            const validClasses = [];
            for (let i = 0; i < curr.classList.length; i++) {
              const className = curr.classList[i].trim();
              if (className && !className.includes(":") && !className.includes(" ")) {
                validClasses.push(CSS.escape(className));
              }
            }
            if (validClasses.length > 0 && `.${validClasses.join(".")}` === uniqueAncestorSelector) {
              path.unshift(uniqueAncestorSelector);
              break;
            }
          }
        }

        // Prepend class names to tag selector to increase quality and skip empty tag:nth-child
        if (curr.classList && curr.classList.length > 0) {
          const validClasses = [];
          for (let i = 0; i < curr.classList.length; i++) {
            const className = curr.classList[i].trim();
            if (className && !className.includes(":") && !className.includes(" ")) {
              validClasses.push(CSS.escape(className));
            }
          }
          if (validClasses.length > 0) {
            selector += `.${validClasses.join(".")}`;
          }
        }

        let sibling = curr;
        let index = 1;
        while (sibling.previousElementSibling) {
          sibling = sibling.previousElementSibling;
          index++;
        }
        selector += `:nth-child(${index})`;
        path.unshift(selector);
        curr = curr.parentNode;
      }
      return path.join(" > ");
    }
  }

  // 1b. Determine Selector Confidence (HIGH, MEDIUM, LOW)
  function determineConfidence(selector) {
    if (!selector) return "LOW";

    const nthChildCount = (selector.match(/:nth-child/g) || []).length;
    if (nthChildCount > 3) {
      console.warn("[Selector Quality Alert]", selector);
    }

    if (nthChildCount > 0) {
      return "LOW";
    }

    // Split selector into parts to see if it is a single ID or single stable attribute selector
    const isIdOnly = selector.startsWith("#") && !selector.includes(" ") && !selector.includes(">");
    const isStableAttrOnly = selector.startsWith("[") && selector.endsWith("]") && !selector.includes(" ") && !selector.includes(">");

    if (isIdOnly || isStableAttrOnly) {
      return "HIGH";
    }

    return "MEDIUM";
  }

  // 2. Create Highlight Overlay Element
  function createOverlay() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.id = "dom-monitor-highlight-overlay";
    overlay.style.position = "absolute";
    overlay.style.pointerEvents = "none";
    overlay.style.border = "2px dashed #00f2fe";
    overlay.style.backgroundColor = "rgba(0, 242, 254, 0.15)";
    overlay.style.zIndex = "2147483647"; // Maximum possible z-index
    overlay.style.boxShadow = "0 0 10px rgba(0, 242, 254, 0.5)";
    overlay.style.transition = "all 0.08s ease-out";
    overlay.style.display = "none";
    document.body.appendChild(overlay);
  }

  // 3. Remove Highlight Overlay Element
  function removeOverlay() {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
      overlay = null;
    }
  }

  // 4. Highlight Element On Hover
  function handleMouseOver(e) {
    if (!isSelecting) return;
    const target = e.target;
    // Don't highlight our own overlay elements if any
    if (target === overlay || 
        target.id === "dom-monitor-recording-overlay" || 
        target.closest("#dom-monitor-recording-overlay") || 
        target.id === "dom-monitor-toast-message") {
      return;
    }

    const rect = target.getBoundingClientRect();
    createOverlay();
    
    overlay.style.top = `${rect.top + window.scrollY}px`;
    overlay.style.left = `${rect.left + window.scrollX}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.display = "block";
  }

  // 5. Handle Natural Navigation Clicks and Selection
  function handleClick(e) {
    if (!isSelecting) return;

    const target = e.target;
    // Ignore clicks inside our overlay or highlight elements
    if (target.id === "dom-monitor-recording-overlay" || 
        target.closest("#dom-monitor-recording-overlay") || 
        target.id === "dom-monitor-highlight-overlay" || 
        target.id === "dom-monitor-toast-message") {
      return;
    }

    const stepSelector = generateSelector(target);
    const textVal = target.textContent ? target.textContent.trim() : "";
    const cleanText = textVal.substring(0, 100);

    // Check for Shift+Click, Ctrl+Click, or Cmd/Meta+Click to finalize selection
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();

      console.log("[FINAL TARGET]", stepSelector);
      finalizeRecordingSelectionDirect(target, stepSelector, textVal);
      return;
    }

    // Normal Click behavior:
    // Do NOT prevent default or stop propagation so that clicks execute normally (modals, tabs, etc.)
    lastClickedElement = target;

    // Update overlay UI preview
    const previewEl = document.getElementById("dom-monitor-selected-preview");
    if (previewEl) {
      previewEl.innerHTML = `Selected: <span style="color: #00f2fe; font-weight: 600;">${stepSelector}</span>`;
    }

    // Enable the capture button
    const btnCapture = document.getElementById("dom-monitor-btn-capture");
    if (btnCapture) {
      btnCapture.disabled = false;
    }

    // Record interaction (avoid consecutive duplicates)
    if (stepSelector) {
      const lastStep = recordedInteractions[recordedInteractions.length - 1];
      if (!lastStep || lastStep.selector !== stepSelector) {
        recordedInteractions.push({
          type: "click",
          selector: stepSelector,
          text: cleanText
        });
        console.log("[CLICK RECORDED]", stepSelector);
        console.log("Recorded interaction step:", { type: "click", selector: stepSelector, text: cleanText });
        console.log("[INTERACTION RECORDED]", recordedInteractions);
      }

      // Update interaction count badge in the overlay
      const countBadge = document.getElementById("dom-monitor-count-badge");
      if (countBadge) {
        countBadge.textContent = `Interactions: ${recordedInteractions.length}`;
      }
    }
  }

  // 6. Create Floating Glassmorphism Recording Overlay
  function createRecordingOverlay() {
    let overlayDiv = document.getElementById("dom-monitor-recording-overlay");
    if (overlayDiv) return;

    overlayDiv = document.createElement("div");
    overlayDiv.id = "dom-monitor-recording-overlay";
    
    // Glassmorphism styling
    overlayDiv.style.position = "fixed";
    overlayDiv.style.bottom = "20px";
    overlayDiv.style.left = "50%";
    overlayDiv.style.transform = "translateX(-50%)";
    overlayDiv.style.width = "480px";
    overlayDiv.style.background = "rgba(15, 23, 42, 0.9)";
    overlayDiv.style.backdropFilter = "blur(12px)";
    overlayDiv.style.webkitBackdropFilter = "blur(12px)";
    overlayDiv.style.border = "1px solid rgba(0, 242, 254, 0.25)";
    overlayDiv.style.borderRadius = "16px";
    overlayDiv.style.padding = "16px 20px";
    overlayDiv.style.color = "#f8fafc";
    overlayDiv.style.fontFamily = "'Outfit', system-ui, -apple-system, sans-serif";
    overlayDiv.style.boxShadow = "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 0 30px rgba(0, 242, 254, 0.15)";
    overlayDiv.style.zIndex = "2147483647";
    overlayDiv.style.display = "flex";
    overlayDiv.style.flexDirection = "column";
    overlayDiv.style.gap = "12px";
    overlayDiv.style.animation = "domMonitorSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards";

    // Inject SlideUp animation dynamically if not present
    if (!document.getElementById("dom-monitor-animations")) {
      const style = document.createElement("style");
      style.id = "dom-monitor-animations";
      style.innerHTML = `
        @keyframes domMonitorSlideUp {
          0% { transform: translate(-50%, 100px); opacity: 0; }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    overlayDiv.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 8px;">
        <span style="font-weight: 700; font-size: 15px; background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;">DOM Monitor Recording</span>
        <span style="font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 12px; background: rgba(0, 242, 254, 0.1); color: #00f2fe; border: 1px solid rgba(0, 242, 254, 0.2);" id="dom-monitor-count-badge">Interactions: 0</span>
      </div>
      <div style="font-size: 13px; color: #94a3b8; line-height: 1.5;">
        Click normally to navigate (click tabs, modals, accordions, etc.).
        To select the final target element, <strong>Shift+Click</strong> (or Ctrl+Click) it, or click it normally and press the button below.
      </div>
      <div id="dom-monitor-selected-preview" style="font-size: 12px; color: #e2e8f0; font-family: monospace; background: rgba(0, 0, 0, 0.2); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.05); word-break: break-all; min-height: 16px;">
        Selected: <span style="color: #94a3b8; font-style: italic;">None (Click an element to target)</span>
      </div>
      <button id="dom-monitor-btn-capture" style="width: 100%; border: none; background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%); color: #0f172a; font-family: inherit; font-size: 13px; font-weight: 700; padding: 10px; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 12px rgba(0, 242, 254, 0.25); transition: all 0.2s;" onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 16px rgba(0, 242, 254, 0.4)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 12px rgba(0, 242, 254, 0.25)';" disabled>
        Capture Current Element
      </button>
    `;

    document.body.appendChild(overlayDiv);

    // Attach Capture Button Handler
    const btnCapture = document.getElementById("dom-monitor-btn-capture");
    btnCapture.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      finalizeRecordingSelection();
    });
  }

  // 7. Remove Recording Overlay
  function removeRecordingOverlay() {
    const overlayDiv = document.getElementById("dom-monitor-recording-overlay");
    if (overlayDiv && overlayDiv.parentNode) {
      overlayDiv.parentNode.removeChild(overlayDiv);
    }
  }

  // Helper to detect image/table monitoring
  function detectImageMonitor(element) {
    console.log("[SELECTED TAG]", element.tagName);
    let relativeUrl = null;
    let monitor_type = "element";
    let image_url = null;

    if (element.tagName.toLowerCase() === "img") {
      monitor_type = "image";
      const srcVal = element.src || element.getAttribute("src") || "";
      try {
        image_url = new URL(srcVal, window.location.href).href;
      } catch (err) {
        image_url = srcVal;
      }
      console.log("[IMAGE DETECTED]", image_url);
    } else if (element.tagName.toLowerCase() === "table" || element.closest("table")) {
      monitor_type = "table";
      console.log("[TABLE DETECTED]");
    } else {
      const bg = window.getComputedStyle(element).backgroundImage;
      if (bg && bg !== "none") {
        const match = bg.match(/^url\((['"]?)(.*?)\1\)$/i);
        if (match) {
          relativeUrl = match[2];
          monitor_type = "image";
          try {
            image_url = new URL(relativeUrl, window.location.href).href;
          } catch (err) {
            image_url = relativeUrl;
          }
          console.log("[IMAGE DETECTED]", image_url);
        }
      }
    }

    return {
      monitor_type: monitor_type,
      image_url: image_url
    };
  }

  // Get suggested monitor name based on tag, monitor_type, selector, and text value
  function getSuggestedName(element, monitor_type, selector, textVal) {
    const text = (textVal || "").toLowerCase();
    const sel = (selector || "").toLowerCase();
    
    if (monitor_type === "image") {
      return "Image Monitor";
    }
    if (monitor_type === "table") {
      return "Table Monitor";
    }
    if (text.includes("₹") || text.includes("$") || text.includes("price") || text.includes("rs") || sel.includes("price")) {
      return "Price Monitor";
    }
    if (text.includes("tender") || text.includes("bid") || sel.includes("tender")) {
      return "Tender Status";
    }
    if (text.includes("stock") || text.includes("qty") || text.includes("quantity") || text.includes("avail") || sel.includes("stock")) {
      return "Stock Value";
    }
    if (monitor_type === "element" && !text) {
      return "Element Monitor";
    }
    
    return "Element Monitor"; // default suggestion
  }

  // Display custom styled modal dialog for immediate monitor naming
  function showNamingModal(targetEl, selector, textVal, imgData, onComplete) {
    const existing = document.getElementById("dom-monitor-naming-modal-backdrop");
    if (existing) {
      existing.parentNode.removeChild(existing);
    }

    const defaultSuggestion = getSuggestedName(targetEl, imgData.monitor_type, selector, textVal);

    const backdrop = document.createElement("div");
    backdrop.id = "dom-monitor-naming-modal-backdrop";
    backdrop.style.position = "fixed";
    backdrop.style.top = "0";
    backdrop.style.left = "0";
    backdrop.style.width = "100vw";
    backdrop.style.height = "100vh";
    backdrop.style.background = "rgba(15, 23, 42, 0.75)";
    backdrop.style.backdropFilter = "blur(4px)";
    backdrop.style.webkitBackdropFilter = "blur(4px)";
    backdrop.style.zIndex = "2147483647";
    backdrop.style.display = "flex";
    backdrop.style.alignItems = "center";
    backdrop.style.justifyContent = "center";
    backdrop.style.fontFamily = "'Outfit', system-ui, -apple-system, sans-serif";

    backdrop.innerHTML = `
      <div style="background: #0f172a; border: 1px solid rgba(0, 242, 254, 0.3); border-radius: 16px; padding: 24px; width: 400px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 0 30px rgba(0, 242, 254, 0.15); display: flex; flex-direction: column; gap: 16px; color: #f8fafc;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 18px; font-weight: 700; background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; margin: 0;">Name Your Monitor</h3>
          <span style="font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 12px; border: 1px solid rgba(0, 242, 254, 0.2); background: rgba(0, 242, 254, 0.1); color: #00f2fe;" id="modal-monitor-type">Monitor Type: ${imgData.monitor_type.toUpperCase()}</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="font-size: 12px; font-weight: 600; color: #94a3b8;">Monitor Name</label>
          <input type="text" id="dom-monitor-name-input" style="width: 100%; padding: 10px 12px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; color: #f8fafc; font-family: inherit; font-size: 14px; box-sizing: border-box; outline: none; transition: border-color 0.2s;" placeholder="e.g. Price Monitor" value="${defaultSuggestion}">
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="font-size: 12px; font-weight: 600; color: #94a3b8;">Check Interval (seconds)</label>
          <input type="number" id="dom-monitor-interval-input" style="width: 100%; padding: 10px 12px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; color: #f8fafc; font-family: inherit; font-size: 14px; box-sizing: border-box; outline: none; transition: border-color 0.2s;" placeholder="e.g. 60" value="60" min="10" max="86400">
          <div id="dom-monitor-interval-helper" style="font-size: 11px; font-weight: 600; margin-top: 4px; display: none;"></div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label style="font-size: 12px; font-weight: 600; color: #94a3b8;">Suggested Names</label>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <button class="dom-suggest-btn" data-name="Price Monitor" style="font-size: 12px; padding: 6px 12px; border-radius: 8px; background: ${defaultSuggestion === 'Price Monitor' ? 'rgba(0, 242, 254, 0.1)' : 'rgba(255, 255, 255, 0.05)'}; border: 1px solid ${defaultSuggestion === 'Price Monitor' ? '#00f2fe' : 'rgba(255, 255, 255, 0.08)'}; cursor: pointer; color: ${defaultSuggestion === 'Price Monitor' ? '#00f2fe' : '#e2e8f0'}; outline: none; transition: all 0.2s;">Price Monitor</button>
            <button class="dom-suggest-btn" data-name="Tender Status" style="font-size: 12px; padding: 6px 12px; border-radius: 8px; background: ${defaultSuggestion === 'Tender Status' ? 'rgba(0, 242, 254, 0.1)' : 'rgba(255, 255, 255, 0.05)'}; border: 1px solid ${defaultSuggestion === 'Tender Status' ? '#00f2fe' : 'rgba(255, 255, 255, 0.08)'}; cursor: pointer; color: ${defaultSuggestion === 'Tender Status' ? '#00f2fe' : '#e2e8f0'}; outline: none; transition: all 0.2s;">Tender Status</button>
            <button class="dom-suggest-btn" data-name="Stock Value" style="font-size: 12px; padding: 6px 12px; border-radius: 8px; background: ${defaultSuggestion === 'Stock Value' ? 'rgba(0, 242, 254, 0.1)' : 'rgba(255, 255, 255, 0.05)'}; border: 1px solid ${defaultSuggestion === 'Stock Value' ? '#00f2fe' : 'rgba(255, 255, 255, 0.08)'}; cursor: pointer; color: ${defaultSuggestion === 'Stock Value' ? '#00f2fe' : '#e2e8f0'}; outline: none; transition: all 0.2s;">Stock Value</button>
            <button class="dom-suggest-btn" data-name="Image Monitor" style="font-size: 12px; padding: 6px 12px; border-radius: 8px; background: ${defaultSuggestion === 'Image Monitor' ? 'rgba(0, 242, 254, 0.1)' : 'rgba(255, 255, 255, 0.05)'}; border: 1px solid ${defaultSuggestion === 'Image Monitor' ? '#00f2fe' : 'rgba(255, 255, 255, 0.08)'}; cursor: pointer; color: ${defaultSuggestion === 'Image Monitor' ? '#00f2fe' : '#e2e8f0'}; outline: none; transition: all 0.2s;">Image Monitor</button>
          </div>
        </div>
        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px;">
          <button id="dom-modal-cancel" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); color: #f8fafc; font-family: inherit; font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 8px; cursor: pointer; transition: background 0.2s;">Cancel</button>
          <button id="dom-modal-submit" style="background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%); border: none; color: #0f172a; font-family: inherit; font-size: 13px; font-weight: 700; padding: 8px 16px; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 12px rgba(0, 242, 254, 0.25); transition: transform 0.2s;">Create Monitor</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const input = document.getElementById("dom-monitor-name-input");
    const cancelBtn = document.getElementById("dom-modal-cancel");
    const submitBtn = document.getElementById("dom-modal-submit");
    const suggestBtns = document.querySelectorAll(".dom-suggest-btn");
    const intervalInput = document.getElementById("dom-monitor-interval-input");
    const helperEl = document.getElementById("dom-monitor-interval-helper");

    input.focus();

    suggestBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        suggestBtns.forEach(b => {
          b.style.background = "rgba(255, 255, 255, 0.05)";
          b.style.borderColor = "rgba(255, 255, 255, 0.08)";
          b.style.color = "#e2e8f0";
        });
        btn.style.background = "rgba(0, 242, 254, 0.1)";
        btn.style.borderColor = "#00f2fe";
        btn.style.color = "#00f2fe";
        
        input.value = btn.getAttribute("data-name");
        input.focus();
      });
    });

    const validateInterval = () => {
      const rawVal = intervalInput.value.trim();
      let parsed = parseInt(rawVal, 10);
      if (isNaN(parsed) || parsed <= 0) {
        intervalInput.value = 60;
        helperEl.textContent = "Invalid interval. Fallback to 60 seconds.";
        helperEl.style.display = "block";
        helperEl.style.color = "#ef4444";
        return 60;
      } else if (parsed < 10) {
        intervalInput.value = 10;
        helperEl.textContent = "Minimum allowed: 10 seconds";
        helperEl.style.display = "block";
        helperEl.style.color = "#f59e0b";
        return 10;
      } else if (parsed > 86400) {
        intervalInput.value = 86400;
        helperEl.textContent = "Maximum allowed: 86400 seconds (24 hours)";
        helperEl.style.display = "block";
        helperEl.style.color = "#f59e0b";
        return 86400;
      } else {
        helperEl.style.display = "none";
        return parsed;
      }
    };

    intervalInput.addEventListener("blur", validateInterval);
    intervalInput.addEventListener("change", validateInterval);

    const cleanup = () => {
      document.removeEventListener("keydown", handleKeydown, true);
      if (backdrop.parentNode) {
        backdrop.parentNode.removeChild(backdrop);
      }
    };

    const handleKeydown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cleanup();
        onComplete(null);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const val = input.value.trim();
        if (val && !submitBtn.disabled) {
          const checkInterval = validateInterval();
          input.disabled = true;
          submitBtn.disabled = true;
          cancelBtn.disabled = true;
          intervalInput.disabled = true;
          submitBtn.textContent = "Creating...";
          onComplete(val, checkInterval, () => {
            cleanup();
          }, (errMsg) => {
            input.disabled = false;
            submitBtn.disabled = false;
            cancelBtn.disabled = false;
            intervalInput.disabled = false;
            submitBtn.textContent = "Create Monitor";
          });
        }
      }
    };

    document.addEventListener("keydown", handleKeydown, true);

    cancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      cleanup();
      onComplete(null);
    });

    submitBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const val = input.value.trim();
      if (val && !submitBtn.disabled) {
        const checkInterval = validateInterval();
        input.disabled = true;
        submitBtn.disabled = true;
        cancelBtn.disabled = true;
        intervalInput.disabled = true;
        submitBtn.textContent = "Creating...";
        onComplete(val, checkInterval, () => {
          cleanup();
        }, (errMsg) => {
          input.disabled = false;
          submitBtn.disabled = false;
          cancelBtn.disabled = false;
          intervalInput.disabled = false;
          submitBtn.textContent = "Create Monitor";
        });
      }
    });
  }

  // 8a. Finalize direct selection from Shift+Click or Ctrl+Click
  function finalizeRecordingSelectionDirect(targetEl, selector, textVal) {
    exitSelectionMode();

    if (targetEl.closest("table")) {
      targetEl = targetEl.closest("table");
      selector = generateSelector(targetEl);
      textVal = targetEl.textContent ? targetEl.textContent.trim() : "";
    }

    const tag = targetEl.tagName;
    const confidence = determineConfidence(selector);

    const cleanUrl = window.location.href.split('#')[0].split('?')[0];
    const storageKey = "selection_" + cleanUrl;
    const imgData = detectImageMonitor(targetEl);

    showNamingModal(targetEl, selector, textVal, imgData, (monitorName, checkInterval, onSuccess, onFailure) => {
      if (!monitorName) {
        // Cancelled naming - do not save selection
        return;
      }

      console.log("[MONITOR NAME]", monitorName);

      const stepsCopy = [...recordedInteractions];

      const selectionData = {
        name: monitorName,
        check_interval: checkInterval,
        selector: selector,
        tag: tag,
        text_snapshot: textVal,
        page_title: document.title,
        selector_confidence: confidence,
        interaction_steps: stepsCopy,
        monitor_type: imgData.monitor_type,
        image_url: imgData.image_url
      };

      console.log("[SELECTION DATA]", selectionData);
      console.log("[SELECTION SAVED]", selectionData);

      chrome.storage.local.set({ [storageKey]: selectionData }, () => {
        console.log("DOM selection cached in storage:", selectionData);
        
        // Build payload and register directly
        const payload = {
          name: monitorName,
          url: window.location.href,
          page_title: document.title,
          selector: selector,
          tag: tag,
          initial_value: imgData.monitor_type === "image" ? imgData.image_url : (textVal || ""),
          text_snapshot: imgData.monitor_type === "image" ? imgData.image_url : (textVal || ""),
          selector_confidence: confidence,
          interaction_steps: stepsCopy,
          monitor_mode: "server",
          check_interval: checkInterval,
          monitor_type: imgData.monitor_type,
          image_url: imgData.image_url
        };
        autoRegisterMonitor(payload, storageKey, onSuccess, onFailure);
      });
    });
  }

  // 8. Finalize the 2-Stage selection
  function finalizeRecordingSelection() {
    if (!lastClickedElement) return;

    exitSelectionMode();

    if (lastClickedElement.closest("table")) {
      lastClickedElement = lastClickedElement.closest("table");
    }

    const selector = generateSelector(lastClickedElement);
    const textVal = lastClickedElement.textContent ? lastClickedElement.textContent.trim() : "";
    const tag = lastClickedElement.tagName;
    const confidence = determineConfidence(selector);

    // Pop off the last clicked element since it's the target itself
    if (recordedInteractions.length > 0) {
      recordedInteractions.pop();
    }

    const cleanUrl = window.location.href.split('#')[0].split('?')[0];
    const storageKey = "selection_" + cleanUrl;
    const imgData = detectImageMonitor(lastClickedElement);

    showNamingModal(lastClickedElement, selector, textVal, imgData, (monitorName, checkInterval, onSuccess, onFailure) => {
      if (!monitorName) {
        // Cancelled naming - do not save selection
        return;
      }

      console.log("[MONITOR NAME]", monitorName);

      const stepsCopy = [...recordedInteractions];

      const selectionData = {
        name: monitorName,
        check_interval: checkInterval,
        selector: selector,
        tag: tag,
        text_snapshot: textVal,
        page_title: document.title,
        selector_confidence: confidence,
        interaction_steps: stepsCopy,
        monitor_type: imgData.monitor_type,
        image_url: imgData.image_url
      };

      console.log("[SELECTION DATA]", selectionData);
      console.log("[SELECTION SAVED]", selectionData);

      chrome.storage.local.set({ [storageKey]: selectionData }, () => {
        console.log("DOM selection cached in storage:", selectionData);
        
        // Build payload and register directly
        const payload = {
          name: monitorName,
          url: window.location.href,
          page_title: document.title,
          selector: selector,
          tag: tag,
          initial_value: imgData.monitor_type === "image" ? imgData.image_url : (textVal || ""),
          text_snapshot: imgData.monitor_type === "image" ? imgData.image_url : (textVal || ""),
          selector_confidence: confidence,
          interaction_steps: stepsCopy,
          monitor_mode: "server",
          check_interval: checkInterval,
          monitor_type: imgData.monitor_type,
          image_url: imgData.image_url
        };
        autoRegisterMonitor(payload, storageKey, onSuccess, onFailure);
      });
    });
  }

  // Direct FastAPI registration call
  async function autoRegisterMonitor(payload, storageKey, onSuccess, onFailure) {
    const API_URL = "http://localhost:8000";
    console.log("[AUTO REGISTER URL]", API_URL);
    console.log("[AUTO REGISTER PAYLOAD]", payload);
    try {
      const response = await fetch(API_URL + "/api/monitor/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP status ${response.status}`);
      }
      
      const resData = await response.json();
      console.log("[AUTO REGISTER SUCCESS]", response);
      
      showPageToast("Monitor Created Successfully", `Monitor "${payload.name}" is now running background checks.`, true);
      // Clear temporary selection state on success
      chrome.storage.local.remove([storageKey], () => {
        if (onSuccess) onSuccess();
      });
    } catch (error) {
      console.error("[AUTO REGISTER FAILED]", error);
      showPageToast("Failed to Create Monitor", error.message || error, false);
      if (onFailure) onFailure(error.message || error);
    }
  }

  // 9. Enter Element Picker Mode
  function enterSelectionMode() {
    isSelecting = true;
    recordedInteractions = [];
    lastClickedElement = null;
    createOverlay();
    createRecordingOverlay();
    
    document.addEventListener("mouseover", handleMouseOver, true);
    document.addEventListener("click", handleClick, true);
    document.body.style.cursor = "crosshair";
  }

  // 10. Exit Element Picker Mode
  function exitSelectionMode() {
    isSelecting = false;
    removeOverlay();
    removeRecordingOverlay();
    
    document.removeEventListener("mouseover", handleMouseOver, true);
    document.removeEventListener("click", handleClick, true);
    document.body.style.cursor = "default";
  }

  // 11. Render Beautiful Page Banner Toast
  function showPageToast(title, body, isSuccess = true) {
    const existing = document.getElementById("dom-monitor-toast-message");
    if (existing) {
      existing.parentNode.removeChild(existing);
    }

    const toast = document.createElement("div");
    toast.id = "dom-monitor-toast-message";
    
    toast.style.position = "fixed";
    toast.style.top = "20px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.background = "rgba(15, 23, 42, 0.95)";
    toast.style.color = "#ffffff";
    toast.style.fontFamily = "'Outfit', system-ui, -apple-system, sans-serif";
    toast.style.fontSize = "14px";
    toast.style.padding = "12px 24px";
    toast.style.borderRadius = "12px";
    toast.style.border = isSuccess ? "1px solid rgba(0, 242, 254, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)";
    toast.style.boxShadow = isSuccess ? "0 8px 32px rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 242, 254, 0.2)" : "0 8px 32px rgba(0, 0, 0, 0.5), 0 0 15px rgba(239, 68, 68, 0.2)";
    toast.style.zIndex = "2147483647";
    toast.style.textAlign = "center";
    toast.style.transition = "opacity 0.5s ease";
    
    toast.innerHTML = `
      <div style="font-weight: 700; color: ${isSuccess ? '#00f2fe' : '#ef4444'}; margin-bottom: 4px;">${title}</div>
      <div style="font-size: 12px; color: #94a3b8; font-family: monospace; word-break: break-all; margin-bottom: 6px;">${body}</div>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 500);
    }, 4000);
  }

  // 12. Chrome Message Receiver
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "start-selection") {
      enterSelectionMode();
      sendResponse({ status: "started" });
    }
  });

})();
