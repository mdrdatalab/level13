define([
    'ash',
    'game/GameGlobals',
    'game/GlobalSignals',
    'game/constants/UIConstants',
    'game/constants/ItemConstants',
    'game/constants/BagConstants',
    'game/nodes/PlayerPositionNode',
    'game/nodes/PlayerLocationNode',
    'game/components/player/BagComponent',
    'game/components/player/ItemsComponent',
    'game/components/common/CampComponent',
], function (
    Ash, GameGlobals, GlobalSignals, UIConstants, ItemConstants, BagConstants,
    PlayerPositionNode, PlayerLocationNode,
    BagComponent, ItemsComponent, CampComponent
) {
    var UIOutEmbarkSystem = Ash.System.extend({
		
		engine: null,
		
		playerPosNodes: null,
		playerLocationNodes: null,
	
		constructor: function (resourceHelper) {            
            this.registerStepperListeners("#embark-resources");            
			return this;
		},
	
		addToEngine: function (engine) {
			this.playerPosNodes = engine.getNodeList(PlayerPositionNode);
			this.playerLocationNodes = engine.getNodeList(PlayerLocationNode);
            GlobalSignals.add(this, GlobalSignals.tabChangedSignal, this.onTabChanged)
			
			this.engine  = engine;
		},

		removeFromEngine: function (engine) {
			this.playerPosNodes = null;
			this.playerLocationNodes = null;
			this.engine = null;
            GlobalSignals.removeAll(this);
		},
		
		initLeaveCampRes: function () {
			if (GameGlobals.gameState.uiStatus.leaveCampRes) {
				var campResources = GameGlobals.resourcesHelper.getCurrentStorage();
				for (var key in resourceNames) {
					var name = resourceNames[key];
					var oldVal = GameGlobals.gameState.uiStatus.leaveCampRes[name];
					var campVal = campResources.resources.getResource(name);
					if (oldVal && oldVal > 0) {
						var value = Math.floor(Math.min(oldVal, campVal));
						$("#stepper-embark-" + name + " input").val(value);
					}
				}
			}
		},
        
        initLeaveCampItems: function () {
			if (GameGlobals.gameState.uiStatus.leaveCampItems) {
                var itemsComponent = this.playerPosNodes.head.entity.get(ItemsComponent);
				for (var key in GameGlobals.gameState.uiStatus.leaveCampItems) {
					var itemID = key;
					var oldVal = GameGlobals.gameState.uiStatus.leaveCampItems[itemID];
					var ownedCount = itemsComponent.getCountById(itemID, true);
					if (oldVal && oldVal > 0) {
						var value = Math.floor(Math.min(oldVal, ownedCount));
						$("#stepper-embark-" + itemID + " input").val(value);
					}
				}
			}
        },
		
		update: function (time) {
            if (GameGlobals.gameState.uiStatus.isHidden) return;
			if (GameGlobals.gameState.uiStatus.currentTab !== GameGlobals.uiFunctions.elementIDs.tabs.out) return;			
            if (!this.playerLocationNodes.head) return;
			
			var posComponent = this.playerPosNodes.head.position;
            // TODO create nice transitions for leaving camp
			GameGlobals.uiFunctions.toggle("#container-tab-enter-out", posComponent.inCamp);
			GameGlobals.uiFunctions.toggle("#container-tab-two-out", !posComponent.inCamp);
			GameGlobals.uiFunctions.toggle("#container-tab-two-out-actions", !posComponent.inCamp);
		},
        
        refresh: function () {
			$("#tab-header h2").text("Leave camp");            
            if (!this.playerLocationNodes.head) return;
            this.updateSteppers();
        },
		
		updateSteppers: function () {
			var campResources = GameGlobals.resourcesHelper.getCurrentStorage();
            var campResourcesAcc = GameGlobals.resourcesHelper.getCurrentStorageAccumulation(false);
            var bagComponent = this.playerPosNodes.head.entity.get(BagComponent);
            var selectedCapacity = 0;
			var selectedAmount;
            
            var selectedWater = 0;
            var selectedFood = 0;
            
			// Resource steppers
			$.each($("#embark-resources tr"), function () {
				var resourceName = $(this).attr("id").split("-")[2];
				var campVal = campResources.resources.getResource(resourceName);
				var visible = campVal > 0;
				var inputMax = Math.min(Math.floor(campVal));
				GameGlobals.uiFunctions.toggle($(this), visible);
                if (visible) {
                    var stepper = $(this).children("td").children(".stepper");
                    var inputMin = 0;
                    var val = $(this).children("td").children(".stepper").children("input").val();
                    GameGlobals.uiFunctions.updateStepper("#" + $(stepper).attr("id"), val, inputMin, inputMax)
                    selectedAmount = Math.max(0, val);
                    selectedCapacity += selectedAmount * BagConstants.getResourceCapacity(resourceName);
                    
                    if (resourceName === resourceNames.water)
                        selectedWater = selectedAmount;
                    if (resourceName === resourceNames.food)
                        selectedFood = selectedAmount;
                }
			});
            
            // Items steppers
            var itemsComponent = this.playerPosNodes.head.entity.get(ItemsComponent);
            var visibleItemTRs = 0;
			$.each($("#embark-items tr"), function () {
				var itemID = $(this).attr("id").split("-")[2];
                var count = itemsComponent.getCountById(itemID, true);
				var visible = count > 0;
                if (visible) visibleItemTRs++;
				GameGlobals.uiFunctions.toggle($(this), visible);
                if (visible) {
                    var stepper = $(this).children("td").children(".stepper");
                    var inputMin = 0;
                    var inputMax = Math.min(Math.floor(count));
                    var inputValue = $(stepper).children("input").val();
                    var val = Math.max(inputValue, inputMin);
                    GameGlobals.uiFunctions.updateStepper("#" + $(stepper).attr("id"), val, inputMin, inputMax)
                    selectedAmount = Math.max(0, $(stepper).children("input").val());
                    selectedCapacity += selectedAmount * BagConstants.getItemCapacity(itemsComponent.getItem(itemID));
                }
			});
			
            GameGlobals.uiFunctions.toggle("#embark-items-container", visibleItemTRs > 0);
            
            bagComponent.selectedCapacity = selectedCapacity;
			$("#embark-bag .value").text(UIConstants.roundValue(bagComponent.selectedCapacity), true, true);
			$("#embark-bag .value-total").text(bagComponent.totalCapacity);
            
            var warning = "";
            var campPopulation = Math.floor(this.playerLocationNodes.head.entity.get(CampComponent).population);
            if (campPopulation > 1) {
                var remainingWater = campResources.resources.getResource(resourceNames.water) - selectedWater;
                var remainingFood = campResources.resources.getResource(resourceNames.food) - selectedFood;
                var isWaterDecreasing = campResourcesAcc.resourceChange.getResource(resourceNames.water) < 0;
                var isFoodDecreasing = campResourcesAcc.resourceChange.getResource(resourceNames.food) < 0;
                if (isWaterDecreasing && selectedWater > 0 && remainingWater <= campPopulation) {
                    warning = "There won't be much water left in the camp.";
                }
                else if (isFoodDecreasing && selectedFood > 0 && remainingFood <= campPopulation) {
                    warning = "There won't be much food left in the camp.";
                }
            }
            $("#embark-warning").text(warning);
            GameGlobals.uiFunctions.toggle("#embark-warning", warning.length > 0);
		},
        
        regenrateEmbarkItems: function () {
            $("#embark-items").empty();
            var itemsComponent = this.playerPosNodes.head.entity.get(ItemsComponent);
            var uniqueItems = itemsComponent.getUnique(true);
			uniqueItems = uniqueItems.sort(UIConstants.sortItemsByType);
            for (var i = 0; i < uniqueItems.length; i++) {
                var item = uniqueItems[i];
                if (item.type === ItemConstants.itemTypes.uniqueEquipment) continue;
                if (item.type === ItemConstants.itemTypes.follower) continue;
                if (item.type === ItemConstants.itemTypes.artefact) continue;
                if (item.type === ItemConstants.itemTypes.note) continue;
                
                var count = itemsComponent.getCountById(item.id, true);
                var showCount = item.equipped ? count - 1 : count;
                if (item.equipped && count === 1) continue;
                
                $("#embark-items").append(
                    "<tr id='embark-assign-" + item.id + "'>" +
                    "<td><img src='" + item.icon + "'/>" + item.name + "</td>" +
                    "<td><div class='stepper' id='stepper-embark-" + item.id + "'></div></td>" +
                    "<td class='list-amount'> / " + showCount + "</div></td>" +
                    "</tr>"
                );
            }
            GameGlobals.uiFunctions.generateSteppers("#embark-items");
            GameGlobals.uiFunctions.registerStepperListeners("#embark-items");
            this.registerStepperListeners("#embark-items");
        },
        
        registerStepperListeners: function (scope) {
            var sys = this;
            $(scope + " input.amount").change(function (e) {
                sys.updateSteppers();
            });
        },
        
        onTabChanged: function () {
			if (GameGlobals.gameState.uiStatus.currentTab !== GameGlobals.uiFunctions.elementIDs.tabs.out) return;
            var posComponent = this.playerPosNodes.head.position;
            if (!posComponent.inCamp) return;
            
            this.initLeaveCampRes();
            this.initLeaveCampItems();
            this.regenrateEmbarkItems();
            this.refresh();
        },
        
		
    });

    return UIOutEmbarkSystem;
});
