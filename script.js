let data1;
let entriesMap = new Map();
let isDataLoaded = false;

let allSources = new Set();
let selectedSources = new Set();

/**
 * 页面加载后，依次获取 variants.json, dictionary_part1.json, dictionary_part2.json
 * 并将字典数据合并到 entriesMap。同时渲染来源选择器。
 * 加强：增加 try/catch 以及返回码校验，提高健壮性。
 */
window.onload = async function () {
    try {
        const [variantsResp, dictResp1, dictResp2] = await Promise.all([
            fetch('variants.json'),
            fetch('dictionary_part1.json'),
            fetch('dictionary_part2.json')
        ]);

        // 如果有任意请求状态不是OK，抛出错误
        if (!variantsResp.ok || !dictResp1.ok || !dictResp2.ok) {
            throw new Error("其中至少一个 JSON 文件加載失敗，請檢查文件路径或网絡狀況。亦或網站正在更新，請稍後再試。");
        }

        const [variantsData, dictionaryData1, dictionaryData2] = await Promise.all([
            variantsResp.json(),
            dictResp1.json(),
            dictResp2.json()
        ]);

        // 简单检查数据结构，如不符合预期则抛出错误
        if (!Array.isArray(variantsData) || !Array.isArray(dictionaryData1) || !Array.isArray(dictionaryData2)) {
            throw new Error("加載的數據格式異常，期待得到數組。");
        }

        data1 = variantsData;

        // 合并 dictionaryData1 和 dictionaryData2 并添加 originalIndex
        const dictionaryData = [...dictionaryData1, ...dictionaryData2];
        dictionaryData.forEach((entry, index) => {
            if (!entry || !entry.character) return;
            if (!entriesMap.has(entry.character)) {
                entriesMap.set(entry.character, []);
            }
            // 在每条记录里加入 originalIndex，以便稍后“注文反查”时可以按原顺序排序
            entriesMap.get(entry.character).push({
                definition: entry.definition || "",
                source: entry.title || "",
                originalIndex: index  // 记录在合并数组中的顺序
            });
            if (entry.title) {
                allSources.add(entry.title);
            }
        });

        checkDataLoaded();
        renderSourceSelector();
    } catch (error) {
        console.error(error);
        alert("數據加載過程中出現錯誤，請稍后重試；或檢查網格/文件狀態。");
    }

    // 监听输入框的回车事件
    const characterInput = document.getElementById("characterInput");
    characterInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            if (isDataLoaded) {
                searchCharacter();
            } else {
                alert("數據正在加載，请稍後再試。");
            }
        }
    });
};

/**
 * 检查数据是否加载完毕，并启用查询按钮。
 */
function checkDataLoaded() {
    if (data1 && entriesMap.size > 0) {
        isDataLoaded = true;
        document.getElementById("searchButton").disabled = false;
        const loadingMsg = document.getElementById("loadingMessage");
        if (loadingMsg) {
            loadingMsg.textContent = "書目已全部加載完畢，請進行檢索。";
            loadingMsg.style.color = "#457c49"; // 加載完成後改為綠色
        }
    }
}

/**
 * 渲染来源选择器部分。支持全选/取消全选。
 * 加强：为避免页面空数据引起的报错，先判断 allSources 是否有内容。
 */
function renderSourceSelector() {
    const table = document.getElementById("sourceSelectorContainer");
    table.innerHTML = "";

    if (allSources.size === 0) {
        // 如果没有任何书目来源，可以给个提示
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.textContent = "尚未檢索到任何書目來源。";
        row.appendChild(cell);
        table.appendChild(row);
        return;
    }

    const sourceCountMap = new Map();
    entriesMap.forEach(entryList => {
        entryList.forEach(item => {
            const title = item.source;
            if (!title) return;
            sourceCountMap.set(title, (sourceCountMap.get(title) || 0) + 1);
        });
    });

    const allTitles = [...allSources].sort((a, b) => {
        const countA = sourceCountMap.get(a) || 0;
        const countB = sourceCountMap.get(b) || 0;
        if (countA !== countB) return countB - countA;

        // 判断是否以汉字开头
        const isHanA = /^[\u4e00-\u9fa5]/.test(a);
        const isHanB = /^[\u4e00-\u9fa5]/.test(b);
        if (isHanA && !isHanB) return -1;
        if (!isHanA && isHanB) return 1;

        return a.localeCompare(b);
    });

    // 创建表头行，包含“全選/取消全選”
    const headerRow = document.createElement("tr");
    const headerCell = document.createElement("td");
    headerCell.colSpan = 2;

    const selectAll = document.createElement("input");
    selectAll.type = "checkbox";
    selectAll.checked = true;
    selectAll.id = "selectAllSources";
    selectAll.onchange = () => {
        const allCheckboxes = table.querySelectorAll("input[type='checkbox']:not(#selectAllSources)");
        selectedSources.clear();
        allCheckboxes.forEach(cb => {
            cb.checked = selectAll.checked;
            if (selectAll.checked) selectedSources.add(cb.value);
        });
    };

    const label = document.createElement("label");
    label.textContent = "全選/取消全選";
    headerCell.appendChild(selectAll);
    headerCell.appendChild(label);
    headerRow.appendChild(headerCell);
    table.appendChild(headerRow);

    // 逐条添加来源选项
    allTitles.forEach(title => {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 2;

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = title;
        checkbox.checked = true;
        checkbox.onchange = () => {
            if (checkbox.checked) {
                selectedSources.add(title);
            } else {
                selectedSources.delete(title);
            }
        };

        const label = document.createElement("label");
        label.textContent = title;

        cell.appendChild(checkbox);
        cell.appendChild(label);
        row.appendChild(cell);
        table.appendChild(row);

        selectedSources.add(title);
    });
}

/**
 * 切换全部勾选/取消的复选框事件。
 */
function toggleAllCheckboxes() {
    const checkboxes = document.querySelectorAll('#filterCheckboxesContainer input[type="checkbox"]:not(#selectAll)');
    const selectAll = document.getElementById('selectAll');
    checkboxes.forEach(checkbox => checkbox.checked = selectAll.checked);
    filterResultsBySource();
}

/**
 * 根据当前过滤选项（来源）隐藏或显示结果表中的相关行。
 */
function filterResultsBySource() {
    const selected = Array.from(
        document.querySelectorAll('#filterCheckboxesContainer input[type="checkbox"]:checked:not(#selectAll)')
    ).map(cb => cb.value);

    const rows = document.querySelectorAll('#resultsTable tbody tr');
    rows.forEach(row => {
        const sourceCell = row.querySelector('td:last-child');
        row.style.display = selected.includes(sourceCell.textContent.trim()) ? '' : 'none';
    });
}

/**
 * 创建结果过滤功能的复选框。
 * 加强：加空数组的防护。
 */
function createFilterCheckboxes(sources) {
    const container = document.getElementById('filterCheckboxesContainer');
    container.innerHTML = '';

    if (!sources || sources.length === 0) {
        container.textContent = '當前結果，中未檢索到任何書目來源。';
        return;
    }

    const selectAll = document.createElement("input");
    selectAll.type = "checkbox";
    selectAll.id = "selectAll";
    selectAll.checked = true;
    selectAll.onchange = toggleAllCheckboxes;
    container.appendChild(selectAll);
    container.appendChild(Object.assign(document.createElement("label"), { textContent: "全選/取消全選" }));
    container.appendChild(document.createElement("br"));

    sources.forEach(source => {
        if (!source) return;
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = source;
        checkbox.checked = true;
        checkbox.onchange = filterResultsBySource;

        const label = document.createElement("label");
        label.textContent = source;

        container.appendChild(checkbox);
        container.appendChild(label);
        container.appendChild(document.createElement("br"));
    });
}

/**
 * 笛卡尔积函数，用于组合所有异体可能
 */
function cartesianProduct(arr) {
    return arr.reduce((a, b) =>
        a.flatMap(d => b.map(e => d + e))
    );
}

/**
 * 计算所有组合数的简便方法：只做乘法，不真正生成组合
 */
function getPossibleCombinationCount(groups) {
    return groups.reduce((acc, arr) => {
        if (!arr || arr.length === 0) return 0;
        return acc * arr.length;
    }, 1);
}

/**
 * 查询函数：
 * 1. 按字查询（可带异体），或
 * 2. 按释文进行反查（可带异体）。
 * 并在生成的组合数超过 5000 时直接禁止。
 */
function searchCharacter() {
    // 基础的输入判空
    const inputChar = document.getElementById("characterInput").value.trim();
    if (!inputChar) {
        alert("請輸入要查詢的字或關鍵詞。");
        return;
    }

    const columnSelect = document.getElementById("columnSelect").value;
    const variantToggle = document.getElementById("variantToggle").value;
    const searchMode = document.getElementById("searchMode").value;

    const resultsBody = document.getElementById("resultsBody");
    const calledGroupsDiv = document.getElementById("calledGroups");
    const descriptionText = document.getElementById("descriptionText");

    // 清空上一次结果
    resultsBody.innerHTML = "";
    document.getElementById("sourceSelectorContainer").style.display = "none";
    Array.from(calledGroupsDiv.children).forEach(child => {
        if (child !== descriptionText) child.remove();
    });

    const matchedVariants = new Set();
    const calledGroups = [];
    const definitionsList = [];
    const seenDefinitions = new Set();
    const uniqueSources = new Set();

    try {
        if (searchMode === "byDefinition") {
            // ====================
            // ★★ 注文反查模式 ★★
            // ====================
            let searchChars = Array.from(inputChar);
            let variantGroups = [];

            if (variantToggle === "withVariants") {
                searchChars.forEach(ch => {
                    let foundGroups = data1.filter(group => group.includes(ch));
                    if (foundGroups.length > 0) {
                        const mergedGroup = [...new Set(foundGroups.flat())];
                        variantGroups.push(mergedGroup);
                    } else {
                        variantGroups.push([ch]);
                    }
                });
            } else {
                variantGroups = searchChars.map(ch => [ch]);
            }

            const possibleCount = getPossibleCombinationCount(variantGroups);
            if (possibleCount > 5000) {
                alert(`組合数量預計將達到 ${possibleCount} 條，超過 5000 條的限制，請縮短輸入或關閉異體字功能後重試。`);
                return;
            }

            const searchPatterns = cartesianProduct(variantGroups);

            entriesMap.forEach((definitions, key) => {
                definitions.forEach(def => {
                    // 判断来源是否被勾选
                    if (!selectedSources.has(def.source)) return;

                    for (let pattern of searchPatterns) {
                        if (def.definition.includes(pattern)) {
                            const uniqueId = `${key}-${def.definition}-${def.source}`;
                            if (!seenDefinitions.has(uniqueId)) {
                                seenDefinitions.add(uniqueId);
                                uniqueSources.add(def.source);
                                const highlighted = def.definition.replaceAll(
                                    pattern,
                                    `<span class="highlight">${pattern}</span>`
                                );
                                definitionsList.push({
                                    character: key,
                                    definition: highlighted,
                                    source: def.source,
                                    // ★ 保存 originalIndex 以备后续按原顺序排序
                                    originalIndex: def.originalIndex
                                });
                            }
                            break;
                        }
                    }
                });
            });

            // ★ 仅在“注文反查”这里做按 originalIndex 升序排序
            definitionsList.sort((a, b) => a.originalIndex - b.originalIndex);

            descriptionText.style.visibility = 'hidden';
            calledGroupsDiv.innerHTML += variantToggle === "withVariants"
                ? `<p class="info-note">您啟用了異體字注文反查功能，已匹配所有異體字組合。</p>`
                : `<p class="info-note">您查詢的是原字注文。</p>`;

        } else {
            // ====================
            // ★★ 查字头模式 ★★
            // ====================
            // 这里保持原逻辑不变
            // ====================
            // ★★ 改良後的“查字頭”模式（全文匹配，逻辑同注文反查） ★★
            // ====================
            let searchChars = Array.from(inputChar);
            let variantGroups = [];

            if (variantToggle === "withVariants") {
                searchChars.forEach(ch => {
                    let foundGroups = data1.filter(group => group.includes(ch));
                    if (foundGroups.length > 0) {
                        const mergedGroup = [...new Set(foundGroups.flat())];
                        variantGroups.push(mergedGroup);
                    } else {
                        variantGroups.push([ch]);
                    }
                });
            } else {
                variantGroups = searchChars.map(ch => [ch]);
            }

            const possibleCount = getPossibleCombinationCount(variantGroups);
            if (possibleCount > 5000) {
                alert(`組合数量預計將達到 ${possibleCount} 條，超過 5000 條的限制，請縮短輸入或關閉異體字功能後重試。`);
                return;
            }

            const searchPatterns = cartesianProduct(variantGroups);

            entriesMap.forEach((definitions, key) => {
                for (let pattern of searchPatterns) {
                    if (key.includes(pattern)) {
                        definitions.forEach(def => {
                            if (!selectedSources.has(def.source)) return;
                            const uniqueId = `${key}-${def.definition}-${def.source}`;
                            if (!seenDefinitions.has(uniqueId)) {
                                seenDefinitions.add(uniqueId);
                                uniqueSources.add(def.source);
                                const highlighted = key.replaceAll(
                                    pattern,
                                    `<span class="highlight">${pattern}</span>`
                                );
                                definitionsList.push({
                                    character: highlighted,
                                    definition: def.definition,
                                    source: def.source,
                                    originalIndex: def.originalIndex
                                });
                            }
                        });
                        break;
                    }
                }
            });

            definitionsList.sort((a, b) => a.originalIndex - b.originalIndex);

            calledGroupsDiv.innerHTML += variantToggle === "withVariants"
                ? `<p class="info-note">您啟用了異體字查正文功能，已匹配所有異體字組合。</p>`
                : `<p class="info-note">您查詢的是原字。</p>`;
        }


        // 根据选择的列渲染表头
        let tableHeader = "<tr>";
        if (columnSelect === "all") {
            tableHeader += "<th>經文</th><th>古注</th><th>來源</th>";
        } else {
            tableHeader += "<th>古注</th>";
        }
        tableHeader += "</tr>";
        document.querySelector("#resultsTable thead").innerHTML = tableHeader;

        // 渲染查询结果
        if (definitionsList.length > 0) {
            const rows = definitionsList.map(def => {
                let row = "<tr>";
                if (columnSelect === "all") {
                    row += `<td>${def.character}</td><td>${def.definition}</td><td>${def.source}</td>`;
                } else {
                    // 当只显示“全文”时，把来源放到隐藏列
                    row += `<td>${def.definition}</td><td style="display:none;">${def.source}</td>`;
                }
                row += "</tr>";
                return row;
            }).join('');
            resultsBody.innerHTML = rows;
            createFilterCheckboxes([...uniqueSources]);
        } else {
            // 若没有找到结果
            resultsBody.innerHTML = "<tr><td colspan='3'>没有找到相關字。</td></tr>";
        }
    } catch (error) {
        console.error(error);
        alert("查詢過程中出現錯誤，請重試。");
    }
}
