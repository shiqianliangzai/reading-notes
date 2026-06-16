const CATEGORIES = [
    { id: "all", label: "全部", accent: "var(--primary)" },
    { id: "thought", label: "思考", accent: "var(--thought)", aliases: ["#思考"] },
    { id: "knowledge", label: "知识", accent: "var(--knowledge)", aliases: ["#知识"] },
    { id: "action", label: "行动", accent: "var(--action)", aliases: ["#行动"] },
    { id: "quote", label: "金句", accent: "var(--quote)", aliases: ["#金句"] },
    { id: "underline", label: "仅划线", accent: "var(--underline)" }
];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((category) => [category.id, category]));
const STORAGE_KEY = "reading-notes-input";
const DEMO_TEXT = `#知识 所以不要妄想有终点，持续努力

原文：即使逃出了生存时间，也是暂时的，还会进入新的生存时间去忍受煎熬。

◆ 即使逃出了生存时间，也是暂时的，还会进入新的生存时间去忍受煎熬。


如何判断自己是否处于生存时间？

◆ 2025/09/25发表想法
#思考
这个问题很有深度
原文：生存时间的判断标准是...`;

function normalizeLine(line) {
    return line.replace(/^\ufeff/, "").replace(/\u00a0/g, " ").trim();
}

function isCategoryLine(line) {
    const trimmed = normalizeLine(line);
    return CATEGORIES.some((category) => (category.aliases || []).some((alias) => trimmed.startsWith(alias)));
}

function getCategoryId(line) {
    const trimmed = normalizeLine(line);
    const match = CATEGORIES.find((category) => (category.aliases || []).some((alias) => trimmed.startsWith(alias)));
    return match ? match.id : null;
}

function isOriginalLine(line) {
    const trimmed = normalizeLine(line);
    return trimmed.startsWith("原文：") || trimmed.startsWith("原文:");
}

function isUnderlineLine(line) {
    return normalizeLine(line).startsWith("◆");
}

function isPersonalNoteMarker(line) {
    const trimmed = normalizeLine(line);
    return /^◆\s*\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}\s*发表想法/.test(trimmed);
}

function trimBlock(lines) {
    let start = 0;
    let end = lines.length;

    while (start < end && !normalizeLine(lines[start])) {
        start += 1;
    }

    while (end > start && !normalizeLine(lines[end - 1])) {
        end -= 1;
    }

    return lines.slice(start, end);
}

function createParserState() {
    return {
        blocks: [],
        currentBlock: [],
        currentCategory: null,
        inPersonalNote: false,
        personalNoteContent: [],
        consecutiveEmptyLines: 0,
        skipNextNonMarked: false
    };
}

function flushCurrentBlock(state) {
    const cleaned = trimBlock(state.currentBlock);
    if (cleaned.length && state.currentCategory) {
        state.blocks.push({
            category: state.currentCategory,
            content: cleaned.join("\n")
        });
    }

    state.currentBlock = [];
    state.currentCategory = null;
}

function handleEmptyLine(state, line) {
    state.consecutiveEmptyLines += 1;
    if (state.consecutiveEmptyLines >= 2) {
        state.skipNextNonMarked = true;
    }

    if (state.inPersonalNote) {
        state.personalNoteContent.push(line);
    } else if (state.currentBlock.length) {
        state.currentBlock.push(line);
    }
}

function handlePersonalNoteMarker(state) {
    flushCurrentBlock(state);
    state.inPersonalNote = true;
    state.personalNoteContent = [];
}

function handlePersonalNoteLine(state, line) {
    if (isOriginalLine(line)) {
        state.currentBlock = [...state.personalNoteContent, line];
        const categoryLine = state.personalNoteContent.find((item) => isCategoryLine(item));
        state.currentCategory = categoryLine ? getCategoryId(categoryLine) : null;
        state.inPersonalNote = false;
        state.personalNoteContent = [];
        return;
    }

    state.personalNoteContent.push(line);
}

function handleCategoryLine(state, line) {
    flushCurrentBlock(state);
    state.currentBlock = [line];
    state.currentCategory = getCategoryId(line);
}

function handleOriginalLine(state, line) {
    if (!state.currentBlock.length) {
        return;
    }

    state.currentBlock.push(line);
}

function handleUnderlineLine(state, line, trimmed) {
    const underlineContent = trimmed.replace(/^◆\s*/, "").trim();
    const originalLine = state.currentBlock.find((item) => isOriginalLine(item));
    const originalContent = originalLine
        ? normalizeLine(originalLine).replace(/^原文[:：]\s*/, "")
        : "";

    if (originalContent && originalContent === underlineContent) {
        return;
    }

    if (state.currentBlock.length > 0 && !originalLine && state.currentCategory) {
        state.currentBlock.push(line);
        flushCurrentBlock(state);
        return;
    }

    flushCurrentBlock(state);
    state.currentBlock = [line];
    state.currentCategory = "underline";
    flushCurrentBlock(state);
}

function parseNotes(inputText) {
    const state = createParserState();
    const lines = inputText.split(/\r?\n/);

    for (const line of lines) {
        const trimmed = normalizeLine(line);

        if (!trimmed) {
            handleEmptyLine(state, line);
            continue;
        }

        const isMarked = isCategoryLine(line) || isOriginalLine(line) || isUnderlineLine(line);
        if (state.skipNextNonMarked && !isMarked) {
            state.skipNextNonMarked = false;
            continue;
        }

        if (isMarked) {
            state.skipNextNonMarked = false;
        }
        state.consecutiveEmptyLines = 0;

        if (isPersonalNoteMarker(line)) {
            handlePersonalNoteMarker(state);
            continue;
        }

        if (state.inPersonalNote) {
            handlePersonalNoteLine(state, line);
            continue;
        }

        if (isCategoryLine(line)) {
            handleCategoryLine(state, line);
            continue;
        }

        if (isOriginalLine(line)) {
            handleOriginalLine(state, line);
            continue;
        }

        if (isUnderlineLine(line)) {
            handleUnderlineLine(state, line, trimmed);
            continue;
        }

        if (state.currentBlock.length > 0) {
            state.currentBlock.push(line);
        }
    }

    flushCurrentBlock(state);
    return state.blocks;
}

function countLines(text) {
    return text.split(/\r?\n/).filter((line) => normalizeLine(line)).length;
}

function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
    }

    return new Promise((resolve, reject) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.setAttribute("readonly", "readonly");
        textArea.style.position = "absolute";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();

        try {
            document.execCommand("copy");
            resolve();
        } catch (error) {
            reject(error);
        } finally {
            textArea.remove();
        }
    });
}

function buildStats(blocks) {
    const counts = Object.fromEntries(CATEGORIES.map((category) => [category.id, 0]));
    blocks.forEach((block) => {
        counts[block.category] = (counts[block.category] || 0) + 1;
    });
    counts.all = blocks.length;
    return counts;
}

document.addEventListener("DOMContentLoaded", () => {
    const notesInput = document.getElementById("notes-input");
    const processBtn = document.getElementById("process-btn");
    const clearBtn = document.getElementById("clear-btn");
    const loadDemoBtn = document.getElementById("load-demo-btn");
    const statusMessage = document.getElementById("status-message");
    const statsGrid = document.getElementById("stats-grid");
    const tabsContainer = document.getElementById("tabs");
    const resultsPanel = document.getElementById("results-panel");
    const resultsMeta = document.getElementById("results-meta");

    let activeCategory = "all";
    let parsedBlocks = [];

    function setStatus(message) {
        statusMessage.textContent = message;
    }

    function saveInput() {
        localStorage.setItem(STORAGE_KEY, notesInput.value);
    }

    function renderStats() {
        const counts = buildStats(parsedBlocks);
        const items = [
            { label: "笔记块", value: counts.all },
            { label: "思考", value: counts.thought },
            { label: "知识", value: counts.knowledge },
            { label: "行动", value: counts.action },
            { label: "金句", value: counts.quote },
            { label: "仅划线", value: counts.underline }
        ];

        statsGrid.innerHTML = "";
        items.forEach((item) => {
            const tile = document.createElement("article");
            tile.className = "stat-tile";
            tile.innerHTML = `<span class="stat-label">${item.label}</span><strong class="stat-value">${item.value}</strong>`;
            statsGrid.appendChild(tile);
        });
    }

    function renderTabs() {
        const counts = buildStats(parsedBlocks);
        tabsContainer.innerHTML = "";

        CATEGORIES.forEach((category) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "tab-btn";
            button.role = "tab";
            button.id = `tab-${category.id}`;
            button.setAttribute("aria-selected", String(activeCategory === category.id));
            button.dataset.category = category.id;
            button.textContent = `${category.label} ${counts[category.id] || 0}`;
            button.addEventListener("click", () => {
                activeCategory = category.id;
                renderTabs();
                renderResults();
            });
            tabsContainer.appendChild(button);
        });
    }

    function createEmptyState(title, description) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.innerHTML = `<h3>${title}</h3><p>${description}</p>`;
        return empty;
    }

    function createNoteCard(block, index) {
        const category = CATEGORY_MAP[block.category] || CATEGORY_MAP.underline;
        const article = document.createElement("article");
        article.className = "note-card";
        article.style.setProperty("--accent", category.accent);

        const header = document.createElement("div");
        header.className = "note-card-header";

        const tag = document.createElement("span");
        tag.className = "note-tag";
        tag.textContent = category.label;

        const copyButton = document.createElement("button");
        copyButton.type = "button";
        copyButton.className = "copy-btn";
        copyButton.textContent = "复制";
        copyButton.setAttribute("aria-label", `复制第 ${index + 1} 条${category.label}笔记`);
        copyButton.addEventListener("click", async () => {
            try {
                await copyText(block.content);
                copyButton.textContent = "已复制";
                setStatus(`已复制一条${category.label}笔记。`);
                window.setTimeout(() => {
                    copyButton.textContent = "复制";
                }, 1500);
            } catch (error) {
                setStatus("复制失败，请手动选中内容复制。");
            }
        });

        header.append(tag, copyButton);

        const content = document.createElement("pre");
        content.className = "note-content";
        content.textContent = block.content;

        const meta = document.createElement("p");
        meta.className = "note-meta";
        meta.textContent = `${countLines(block.content)} 行内容`;

        article.append(header, content, meta);
        return article;
    }

    function renderResults() {
        resultsPanel.innerHTML = "";

        if (!parsedBlocks.length) {
            resultsMeta.textContent = "还没有整理结果。";
            resultsPanel.appendChild(createEmptyState("等待整理", "输入阅读笔记后，整理结果会显示在这里。"));
            return;
        }

        const visibleBlocks = activeCategory === "all"
            ? parsedBlocks
            : parsedBlocks.filter((block) => block.category === activeCategory);

        const currentCategory = CATEGORY_MAP[activeCategory] || CATEGORY_MAP.all;
        resultsMeta.textContent = `当前查看：${currentCategory.label} · 共 ${visibleBlocks.length} 条`;

        if (!visibleBlocks.length) {
            resultsPanel.appendChild(createEmptyState("这一类还没有内容", "试试切换到其他分类，或者调整输入格式后重新整理。"));
            return;
        }

        const grid = document.createElement("div");
        grid.className = "results-grid";
        visibleBlocks.forEach((block, index) => {
            grid.appendChild(createNoteCard(block, index));
        });
        resultsPanel.appendChild(grid);
    }

    function runProcessing() {
        const inputText = notesInput.value.trim();
        if (!inputText) {
            parsedBlocks = [];
            renderStats();
            renderTabs();
            renderResults();
            setStatus("先输入一点内容，我们再开始整理。");
            notesInput.focus();
            return;
        }

        parsedBlocks = parseNotes(notesInput.value);
        activeCategory = "all";
        renderStats();
        renderTabs();
        renderResults();
        setStatus(`整理完成，共识别 ${parsedBlocks.length} 条笔记。`);
    }

    notesInput.value = localStorage.getItem(STORAGE_KEY) || "";
    renderStats();
    renderTabs();
    renderResults();

    notesInput.addEventListener("input", saveInput);
    processBtn.addEventListener("click", runProcessing);

    clearBtn.addEventListener("click", () => {
        notesInput.value = "";
        parsedBlocks = [];
        activeCategory = "all";
        saveInput();
        renderStats();
        renderTabs();
        renderResults();
        setStatus("内容已清空。你可以重新粘贴新的笔记。");
        notesInput.focus();
    });

    loadDemoBtn.addEventListener("click", () => {
        notesInput.value = DEMO_TEXT;
        saveInput();
        runProcessing();
    });

    if (notesInput.value.trim()) {
        runProcessing();
    }
});

window.__readingNotesParser = {
    parseNotes
};
