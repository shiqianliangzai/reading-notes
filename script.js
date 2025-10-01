document.addEventListener('DOMContentLoaded', () => {
    console.log('读书笔记分类器初始化');

    const notesInput = document.getElementById('notes-input');
    const processBtn = document.getElementById('process-btn');
    const clearBtn = document.getElementById('clear-btn');
    const tabs = Array.from(document.querySelectorAll('.tab-btn'));
    const sections = Array.from(document.querySelectorAll('.category-section'));
    const VALID_CATEGORIES = ['思考', '知识', '行动', '金句', '仅划线'];
    let currentCategory = 'all';

    if (!notesInput || !processBtn) {
        alert('页面结构缺失，请检查 HTML');
        return;
    }

    const showCategory = (category) => {
        // 检查分类是否存在，如果不存在则使用'all'
        const validCategories = ['all', '思考', '知识', '行动', '金句', '仅划线', 'uncategorized'];
        if (!validCategories.includes(category)) {
            category = 'all';
        }
        currentCategory = category;

        tabs.forEach(tab => {
            const tabCategory = tab.dataset.category || 'all';
            const active = tabCategory === category;
            tab.classList.toggle('active', active);
            if (active) {
                console.log(`切换到分类: ${category}`);
            }
        });

        sections.forEach(section => {
            // 修正分类匹配逻辑
            const sectionCategory = section.id;
            const active = sectionCategory === category;
            section.classList.toggle('active', active);
        });
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetCategory = tab.dataset.category || 'all';
            showCategory(targetCategory);
        });
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            notesInput.value = '';
            clearCategories();
            showCategory('all');
            notesInput.focus();
            console.log('已清空内容并回到全部分类');
        });
    }

    if (processBtn) {
        processBtn.addEventListener('click', () => {
            const inputText = notesInput.value;
            if (!inputText.trim()) {
                alert('请输入笔记内容');
                notesInput.focus();
                return;
            }
            try {
                processNotes(inputText);
            } catch (error) {
                console.error('分类时出错:', error);
                alert('分类时出错: ' + error.message);
            }
        });
    }

    showCategory('all');

    function processNotes(inputText) {
        clearCategories();

        const lines = inputText.split(/\r?\n/);
        const noteBlocks = [];
        let currentBlock = [];
        let currentCategory = 'uncategorized';
        let consecutiveEmptyLines = 0;
        let skipNextNonMarked = false;
        let inPersonalNote = false;
        let personalNoteContent = [];

        const flushCurrentBlock = () => {
            if (currentBlock.length === 0) return;

            let start = 0;
            let end = currentBlock.length;
            while (start < end && currentBlock[start].trim() === '') start++;
            while (end > start && currentBlock[end - 1].trim() === '') end--;

            if (start >= end) {
                currentBlock = [];
                currentCategory = 'uncategorized';
                return;
            }

            const content = currentBlock.slice(start, end).join('\n');
            if (content.trim()) {
                noteBlocks.push({ content, category: currentCategory });
            }
            
            currentBlock = [];
            currentCategory = 'uncategorized';
        };

        lines.forEach(line => {
            const trimmed = line.trim();
            
            // 处理空行
            if (!trimmed) {
                consecutiveEmptyLines++;
                if (consecutiveEmptyLines >= 2) {
                    skipNextNonMarked = true;
                    console.log('检测到连续两个空行，设置 skipNextNonMarked = true');
                }
                if (currentBlock.length > 0) currentBlock.push(line);
                return;
            }
            
            consecutiveEmptyLines = 0;

            // 检查是否是标记内容
            const hasMark = trimmed.startsWith('#思考') || trimmed.startsWith('#知识') || 
                trimmed.startsWith('#行动') || trimmed.startsWith('#金句') ||
                trimmed.startsWith('原文：') || trimmed.startsWith('◆');

            console.log(`处理行: '${trimmed}', hasMark: ${hasMark}, skipNextNonMarked: ${skipNextNonMarked}`);

            // 跳过章节标题（无论当前是否有活跃块）
            if (skipNextNonMarked && !hasMark) {
                console.log(`跳过章节标题: '${trimmed}'`);
                skipNextNonMarked = false;
                return;
            }
            
            // 只有在遇到标记内容时才重置跳过标记
            if (hasMark) {
                skipNextNonMarked = false;
            }

            // 检查是否是分类标签
            if (trimmed.startsWith('#思考') || trimmed.startsWith('#知识') || 
                trimmed.startsWith('#行动') || trimmed.startsWith('#金句')) {
                flushCurrentBlock();
                currentBlock = [line];
                currentCategory = determineCategory(line);
                return;
            }

            // 检查是否是个人想法的开始标记
            const isPersonalNoteStart = trimmed.startsWith('◆') && 
                (trimmed.includes('发表想法') || /\d{4}年\d{1,2}月\d{1,2}日/.test(trimmed));
            
            const isOriginalText = trimmed.startsWith('原文：');
            const isPureUnderline = trimmed.startsWith('◆') && !isPersonalNoteStart;

            if (isPersonalNoteStart) {
                // 开始个人想法记录
                flushCurrentBlock();
                inPersonalNote = true;
                personalNoteContent = [];
                return;
            }

            if (isOriginalText) {
                if (inPersonalNote) {
                    // 个人想法中的原文，合并到当前块
                    if (personalNoteContent.length > 0) {
                        currentBlock = [...personalNoteContent, line];
                        inPersonalNote = false;
                    } else {
                        currentBlock = [line];
                    }
                } else {
                    flushCurrentBlock();
                    currentBlock = [line];
                }
                return;
            }

            if (isPureUnderline) {
                // 检查去重
                const underlineContent = trimmed.replace(/^◆\s*/, '').trim();
                let isDuplicate = false;
                
                if (currentBlock.length > 0) {
                    for (const blockLine of currentBlock) {
                        const blockTrimmed = blockLine.trim();
                        if (blockTrimmed.startsWith('原文：')) {
                            const originalContent = blockTrimmed.replace(/^原文：\s*/, '').trim();
                            if (originalContent === underlineContent) {
                                isDuplicate = true;
                                break;
                            }
                        }
                    }
                }
                
                if (isDuplicate) {
                    return;
                }
                
                flushCurrentBlock();
                currentBlock = [line];
                currentCategory = '仅划线';  // 设置分类为"仅划线"
                flushCurrentBlock();
                return;
            }

            // 如果是个人想法内容，暂存
            if (inPersonalNote) {
                personalNoteContent.push(line);
                return;
            }

            // 普通文本行
            if (currentBlock.length > 0) {
                currentBlock.push(line);
            }
        });

        flushCurrentBlock();

        console.log(`解析到 ${noteBlocks.length} 条笔记`);

        noteBlocks.forEach((note, index) => {
            console.log(`创建第 ${index + 1} 条笔记，分类: ${note.category}`);
            createNoteCard(note.content, note.category);
        });

        // 分类后默认显示在"全部"标签
        showCategory('all');
    }

    function determineCategory(line) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#思考')) return '思考';
        if (trimmed.startsWith('#知识')) return '知识';
        if (trimmed.startsWith('#行动')) return '行动';
        if (trimmed.startsWith('#金句')) return '金句';
        return 'uncategorized';
    }

    function createNoteCard(content, category) {
        const normalized = VALID_CATEGORIES.includes(category) ? category : 'uncategorized';
        const displayName = normalized === 'uncategorized' ? '未分类' : normalized;

        const categoryContainer = document.getElementById(`${normalized}-notes`);
        const allContainer = document.getElementById('all-notes');

        if (!categoryContainer || !allContainer) {
            console.error('找不到分类容器:', normalized);
            return;
        }

        const noteCard = document.createElement('div');
        noteCard.className = `note-card ${normalized}`;

        // 创建标签
        const tagSpan = document.createElement('span');
        tagSpan.className = `note-tag ${normalized}`;
        tagSpan.textContent = displayName;

        // 创建复制按钮
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.title = '复制内容';
        
        // 复制功能
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            
            // 复制内容到剪贴板
            navigator.clipboard.writeText(content).then(() => {
                // 显示复制成功反馈
                copyBtn.classList.add('copied');
                copyBtn.title = '已复制！';
                
                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    copyBtn.title = '复制内容';
                }, 2000);
            }).catch(err => {
                console.error('复制失败:', err);
                // 备用复制方法
                const textArea = document.createElement('textarea');
                textArea.value = content;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                
                copyBtn.classList.add('copied');
                copyBtn.title = '已复制！';
                
                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    copyBtn.title = '复制内容';
                }, 2000);
            });
        });

        // 创建内容区域
        const contentDiv = document.createElement('div');
        contentDiv.className = 'note-content';

        const pre = document.createElement('pre');
        pre.className = 'full-content';
        pre.textContent = content;

        contentDiv.appendChild(pre);
        noteCard.appendChild(tagSpan);
        noteCard.appendChild(copyBtn); // 添加复制按钮
        noteCard.appendChild(contentDiv);

        // 点击卡片也可以复制
        noteCard.addEventListener('click', () => {
            navigator.clipboard.writeText(content).then(() => {
                // 显示复制成功反馈
                copyBtn.classList.add('copied');
                copyBtn.title = '已复制！';
                
                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    copyBtn.title = '复制内容';
                }, 2000);
            }).catch(err => {
                console.error('复制失败:', err);
                // 备用复制方法
                const textArea = document.createElement('textarea');
                textArea.value = content;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                
                copyBtn.classList.add('copied');
                copyBtn.title = '已复制！';
                
                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    copyBtn.title = '复制内容';
                }, 2000);
            });
        });

        // 创建副本用于分类容器
        const noteCardClone = noteCard.cloneNode(true);
        
        categoryContainer.appendChild(noteCardClone);
        allContainer.appendChild(noteCard);
    }

    function clearCategories() {
        const containers = ['思考', '知识', '行动', '金句', '仅划线', 'uncategorized', 'all'];
        containers.forEach(key => {
            const container = document.getElementById(`${key}-notes`);
            if (container) container.innerHTML = '';
        });
    }
});