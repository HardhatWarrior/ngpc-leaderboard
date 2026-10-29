
(function () {
"use strict";
var DATA = {"alphabet":"ABCDEFGHJKLMNPQRSTUVWXYZ23456789","salt":"GN-TALE-CODE","version":13,"maxSyms":320,"maxSyms14":208,"maxGold":9999,"items":[{"name":"","kind":"IK_NONE","power":0,"price":0,"desc":["",""]},{"name":"HERB","kind":"IK_HEAL","power":30,"price":8,"desc":["RESTORES 30 HP.","SMELLS OF RAIN."]},{"name":"POTION","kind":"IK_HEAL","power":90,"price":30,"desc":["RESTORES 90 HP.","BITTER, BUT WARM."]},{"name":"ETHER","kind":"IK_MP","power":20,"price":40,"desc":["RESTORES 20 MP.","TASTES OF STARS."]},{"name":"WING","kind":"IK_WING","power":0,"price":25,"desc":["OUTSIDE, FLIES YOU","TO THE LAST TOWN."]},{"name":"ELIXIR","kind":"IK_FULL","power":0,"price":250,"desc":["FULL HP AND MP.","THE WITCH'S BEST."]},{"name":"OAK STAFF","kind":"IK_WEAPON","power":2,"price":10,"desc":["BEATS TIME, AND","THE ODD SLIME."]},{"name":"BRONZE SWORD","kind":"IK_WEAPON","power":7,"price":60,"desc":["CAST FROM AN OLD","CRACKED BELL."]},{"name":"IRON SWORD","kind":"IK_WEAPON","power":13,"price":220,"desc":["FORGED IN LARGO.","IT RINGS TRUE."]},{"name":"STEEL SWORD","kind":"IK_WEAPON","power":20,"price":600,"desc":["TEMPERED IN THE","SNOWS OF FERMATA."]},{"name":"SILVER BLADE","kind":"IK_WEAPON","power":28,"price":1500,"desc":["THE SMITH'S PRIDE.","BRIGHT AS A BELL."]},{"name":"MOON SABER","kind":"IK_WEAPON","power":38,"price":3800,"desc":["SERENADE'S FINEST.","GLOWS AT DUSK."]},{"name":"NIGHTSONG","kind":"IK_WEAPON","power":50,"price":0,"desc":["CASSIUS'S BLADE.","SINGS AS IT CUTS."]},{"name":"CLOTHES","kind":"IK_ARMOR","power":2,"price":10,"desc":["A STUDENT'S COAT,","PATCHED AT ELBOWS."]},{"name":"LEATHER MAIL","kind":"IK_ARMOR","power":5,"price":50,"desc":["HUNTER'S LEATHER.","STIFF BUT LIGHT."]},{"name":"CHAIN MAIL","kind":"IK_ARMOR","power":10,"price":200,"desc":["A THOUSAND RINGS.","IT JINGLES."]},{"name":"IRON PLATE","kind":"IK_ARMOR","power":16,"price":550,"desc":["A KNIGHT'S PLATE.","HEAVY, BUT SOUND."]},{"name":"SILVER MAIL","kind":"IK_ARMOR","power":23,"price":1400,"desc":["SILVER FROM THE","OLD MINES."]},{"name":"MOON ROBE","kind":"IK_ARMOR","power":31,"price":3600,"desc":["WOVEN BY MOONLIGHT","IN SERENADE."]},{"name":"STARCLOAK","kind":"IK_ARMOR","power":40,"price":0,"desc":["MIRA'S OWN CLOAK,","SEWN WITH STARS."]},{"name":"SEA COAT","kind":"IK_ARMOR","power":20,"price":1000,"desc":["A KEEPER'S OILSKIN","RAIN RUNS OFF IT."]},{"name":"SEXTANT","kind":"IK_KEY","power":0,"price":0,"desc":["SPEEDS THE SHIP.","AT NIGHT, ANY DOCK"]},{"name":"ECHO BRAND","kind":"IK_WEAPON","power":58,"price":4800,"desc":["IT STRIKES, THEN","AT TIMES ITS ECHO."]},{"name":"REQUIEM","kind":"IK_WEAPON","power":66,"price":7200,"desc":["A BLACK BLADE FOR","SONGS THAT ENDED."]},{"name":"VESPER'S BOW","kind":"IK_WEAPON","power":75,"price":9800,"desc":["THE OLD MAESTRO'S","BOW. IT HUMS LOW."]},{"name":"DIRGE MAIL","kind":"IK_ARMOR","power":46,"price":4500,"desc":["DARK PLATE THAT","HUMS A SLOW DIRGE."]},{"name":"AURORA ROBE","kind":"IK_ARMOR","power":52,"price":6800,"desc":["WOVEN OF NORTHERN","LIGHTS. IT GLOWS."]},{"name":"VESPER COAT","kind":"IK_ARMOR","power":60,"price":9500,"desc":["VESPER'S OLD COAT,","WARM AS A LULLABY."]},{"name":"SHEET MUSIC","kind":"IK_KEY","power":0,"price":0,"desc":["PAGES IN CHOPIN'S","OWN HAND."]},{"name":"EAST CLOAK","kind":"IK_ARMOR","power":34,"price":0,"desc":["A LIGHTHOUSE CLOAK","SALT-STIFF, WARM."]},{"name":"?","kind":"IK_WEAPON","power":62,"price":0,"desc":["",""]},{"name":"?","kind":"IK_ARMOR","power":50,"price":0,"desc":["",""]},{"name":"?","kind":"IK_WEAPON","power":60,"price":0,"desc":["",""]},{"name":"?","kind":"IK_ARMOR","power":48,"price":0,"desc":["",""]}],"flags":{"INTRO_SEEN":1,"HALL_OPEN":2,"KING_SEALED":4,"SHIP":8,"PASSAGE":16},"maxLv":20,"lvX":25,"bagSlots":8,"towns":["CODA","LARGO","FERMATA","SERENADE"],"townExit":[[66,82],[102,70],[58,28],[24,62]],"itSextant":21,"itSheets":28,"levels":[[0,15,5,6,4,4],[7,22,8,8,5,5],[23,28,10,10,7,6],[47,34,13,12,8,8],[110,40,16,14,10,9],[220,46,18,17,12,10],[360,52,21,19,13,12],[550,58,24,22,15,13],[800,64,27,24,17,15],[1100,70,30,27,18,16],[1500,76,33,29,20,18],[2000,82,36,32,22,19],[2600,88,39,34,23,21],[3300,94,42,37,25,22],[4100,100,45,39,27,24],[5000,106,48,42,28,25],[6000,112,51,44,30,27],[7200,118,54,47,32,28],[8600,124,57,49,33,30],[10000,130,60,52,35,31],[12000,136,63,54,37,32],[13700,142,66,57,38,34],[15500,148,69,59,40,35],[17400,154,72,62,41,37],[19400,160,74,64,43,38],[21400,164,77,67,44,39],[23400,168,80,69,46,41],[25400,172,83,72,47,42],[27400,176,86,74,49,44],[29400,180,89,77,50,45],[31400,183,92,79,52,46],[33400,186,95,82,53,48],[35400,189,98,84,55,49],[37400,192,101,87,56,51],[39400,195,104,89,58,52]],"guardians":["SERA","ODEN","MIRA","CASSIUS"],"kindsB64":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABVVVVVVQAAAAAFVVVVVQAAAFVVVVVVAAAAAAVVVVAAAAAAVVVVVVUAAAAABVVVUAAAAAAFVVVVVQAAAFVVAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVRERFVVVURERVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVRERERERFVEYEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVISEhESEhEhEREVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUREREREiESERERERFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVURERERESEhEREREREiEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVERIREhERERERIRIQABERESVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUAVVVVVVVVVVVVVVVVVVVVVVVVVVVVIRERAAEREhISIREhEAAREAESESVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAFVVVVVVVVVVVVVVVVVVVVVVVVUQEiESABEgABESIRERAAEhEREQABERFVVVVVVVVVVVVVVVVVVVVVVVVVVVVQBVVVVVVVVVVVVVVVVVVVVVVVEhERIQABERERERABEQABEREREREREAESFVVVVVVVVVVVVVVVVVVVVVVVVVVVUAVVVVVVVVVVVVVVVVVVVVVVEREREQAhERERESESIAAREREREREREREQAhEVVVVVVVVVVVVVVVVVVVVVVVVVVVAFVVVVVVVVVVVVVVVVVVVVURESEQASEiEREREhEhIREREhERERERERERABEVVVVVVVVVVVVVVVVVVVVVVVVVVQAFVVVVVVVVVVVVVVVVVVVRESIREREREhESESESEREREhERIRIREiEREREREVVVVVVVVVVVVVVVVVVVVVVVVVAABVVVVVVVVVVVVVVVVVVVURERERIRERERESERIhEYERIRERIREREREhEhEREVVVVVVVVVVVVVVRERVVVVVVVQAAVVVVVVVVVVVVVVVVVVVVERIRERERERIRERESERIRERESIhESIRERERERAQFVVVVVVVVVVVVREREVVVVVVVUAAFVVVVVVVVVVVVVVVVVVVREREiEREhEhEREhIRERERISIREREREiESERIRERJVVVVVVVVVVVURGBFVVVVVVVAABVVVVVVVVVVVVVVVURVVUREhIREREREREhIRIRERERERIhEREgAAERERERESVVVVVVVVVVVVERERVVVVVVVQAAVVVVVVVVVVVVVVURERVVEREhEhEhEREiEREAAAABEREREQAAASISISIREiElVVVVVVVVVVVVUREVVVVVVVUAAFVVVVVVVVVVVVVREYERVRERERIREREREAAAIiIRERAAAAAhEREREREiERERFVVVVVVVVVVVVVUVVVVVVVVVAABVVVVVVVVVVVVVUREREVURESERASERAAIRESEhIhERERIRIREREREREhESESVVVVVVVVVVVVVVZVVVVVVVVQAAVVVVVVVVVVVVVRERERFVERERESEREREiIhEREiEhEREhERIhIRESEiEhEiFVVVVVVVVVVVVVVWVVVVVVVVUABVVVVVVVVVVVVVVRERERVVEhESEREREREREhEQAAARESERERERERERERERERVVVVVVVVVVVVVVVVVVVVVVVVUAVVVVVVVVVVVVVVVVVRVVVVURERERIREREREhEAAAESEREhERIRIhERERERFVVVVVVVVVVVVVVVVVVVVVVVVVAFVVVVVVVVVVVVVVVVVlVVVVVVEhERIhIRERERAAABESERESIREhESIRIRIVVVVVVVVVVVVVVVVVVVVVVVVVVQBVVVVVVVVVVVVVVVVVZVVVVVVVVREREREREhEQCAAiEBIREhESISERIRIVVVVVVVVVVVVVVVVVVVVVVVVVVVUAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVEREhEREREVVVURERERIRERIlVVVVVVVVVVVVVVVVVVVVVVVVVVVVAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVWVVVVVVVVURERERFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVlVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVRERERFVVVVVVVVVVVVVVVVVVVVVVRERERVVVVVVVVVVUAVVVVVVVVVVVVVVVVVVVVVVVVVVVVURERERVVVVVRERERERFVVVVVVVVVVVVVVVVVVVVVERERERVVVVVVVVVVAFVVVVVVVVVVVVVVVVVVVVVVVVVVUREiIhERERVVERERERERFVVVVVVVVVVVVVVVVVVVURERERERVVVVVVVVVQBVVVVVVVVVVVVVVVVVVVVVVVVVEREiIiIiIRERURERERERERFVVVVVVVVVVVVVVVVVVVERERERERVVVVVVVVUAVVVVVVVVVVVVVVVVVVVVVVVRERESIhEiIiIRERERERERERERFVVVVVVVVVVVVVVVVVUREREREREVVVVVVVVVAFVVVVVVVVURERFVVVVVVVVRERERIiIhIiIiIRERERERERERIhFVVVVVVVVVVVVVVVVVEREREREREVVVVVVVVQBVVVVVVVVRERERFVVVVVVVEREREiEiEiIiEiEREREREREREiIiJVVVVVVVVVVVVVVVVREREREREQEFVVVVVVUABVVVVVVVERIRERFVVVVVVREREiIiIiERESIhERERERERERIiIiVVVVVVVVVVVVVVVVEREREREREREVVVVVVQAAVVVVVVURERERIhFVVVVVURESIiIiIhgSEiKBERERERERESIiIRVVVVVVVVVVVVVVVRERERERERERFVVVVVUAAFVVVVVSIiIhEhESFVVVVVEREiIiIiITEhIiERERERERERESERERVVVVVVVVVVVVVVUREREREREREREVVVVVAABVVVVVUSIiIhEhERVVVVVRESIiEiIiIjIiIhEREREREREREREREVVVVVVVVVVVVVVVEREREREREREREVVVVQAAVVVVVSESIhEREhEVVVVVVREiIiIhIiIjIiIREREREREREREREREVVVVVVVVVVVVVVRERERERERERERERVVUAAFVVVVURISEREREREVVVVVURIiIiIiISIjIhEREREREREREREREREVVVVVVVVVVVVVERERERERERERERERVVAABVVVVRIRERERESERFVVVVVVRIiIiIiIiEjEiERERERERERERERERFVVVVVVVVVVVVREREREREREREREREVVQAAVVVVURERIRERERERVVVVVVVRESISEiEiIjIhEREREREREREQEBERFVVVVVVVVVVVURERERERgREREREREVUAAFVVVRAQERESEhEREVVVVVVVURESIiIiIiITMRERERERERERERERERVVVVVVVVVVVVERERERERERERERERFVAAVVVVUREREhERERAAAFVVVVVVERESIhIiISIRMREREREREREREBERERVVVVVVVVVVVRERERERVVVVURERERVVAFVVVVIiEhEREREQAABVVVVVVRERESIiIhEiERMxEREREREREREREREVVVVVVVVVVVURERERBVVVVVEREREVVQBVVVURERERIRERIAAAEFVVVVURERERERERERERExERERERERERERERFVVVVVVVVVVVEREREVVVVVVRERERFVUAVVVVEREREhERERAIABFVVVVVERERERERERERERExEREAAAERERERERVVVVVVVVVVVRERERVVURFVUREREVVVAFVVVSESEREREhEREzM2ZVVVVREREREREREREREREzEQEREQERERIhEVVVVVVVVVVVURERMzMzGBVVERERFVVQBVVVEREREREhERISESEVVVVVUREQEREREREREREAETEREREQABIiIhFVVVVVVVVVVVEREzFVVVEVVRERERVVUABVVSERIhERERESEhERIVVVVVURERERERIREREQERETERERERECIiERVVVVVVVVVVVVERETFVVVVVURIiFVVQAAVVUREREhEREhEREhESEVVVVVEREREREiIiEQARERExEREREREiIiFVVVVVVVVVVVVRERExEVVVVVESIhVVUAAFVVASIAEhERERIAARERIVVVVRERERERIiIiARERERExERERERERERVVVVVVVVVVVVUAAAMRFVVVURIiIVVVAABVVRERIQESERAAERESIREVVVURERERESIiIRERERERMRERERERERFVVVVVVVVVVVVVAAADERFVURESIiFVVQAAVVVREREREAABEREiEhERFVVVURERERERIRERERERERMRERERERExVVVVVVVVVVVVUAAAAxERERERESIhVVUAAFVVUREiIREREiESIhEhIRVVVVERERERERERERERERETERERERETFVVVVVVVVVVVVVEAgAMREREREREREVVVAABVVVERERERERIREiIhEiEVVVVRERERERERERERERERETERERERMRVVVVVVVVVVVVVmETMzERERARERERVVVQAAVVVRERERERERISIiERIiFVVVVRERERERERERIRERERExERERExFVVVVVVVVVVVVVVREREREREQEREREVVVUAAFVVURERISERERIhERIRIRVVVVUREREREREREiIiERERMRERETERVVVVVVVVVVVVVVURERERERERERERFVVVAAVVVVEREREREhEhERERERFVVVVVURERERERERIiIiERETERERMREVVVVVVVVVVVVVVVEREREREBEQEREVVVVVAFVVURIRERERERgRESERIRVVVVVVERERERERESIiIRERExERExERVVVVVVVVVVVVVVVRERERERERERERVVVVVQBVVVEiIiERERIREhEhERElVVVVVVERERERERERIRERERMRETEREVVVVVVVVVVVVVVVURESERERERERFVVVVVUAVVVSIiIiIiERISEhERERVVVVVVVREREREREREREQERETERExERFVVVVVVVVVVVVVVVESIiEREREREVVVVVVVAFVVUSIiISEREREREREhEVVVVVVVVREREREREREBEREzMxETERERVVVVVVVVVVVVVVVRESIhERERERVVVVVVVQBVVREhIRERIRERERESEhFVVVVVVVVRERERERERAQERMAAAMREREVVVVVVVVVVVVVVVVREiIRERERFVVVVVVVUAVVURERISIiESISERERIVVVVVVVVVVVERERERERERETAAADERERFVVVVVVVVVVVVVVVURESEREREVVVVVVVVVAFVVERESEhERIREREBERFVVVVVVVVVVVUREREREREREwAAAxEREVVVVVVVVVVVVVVVVVERERERERVVVVVVVVVQBVVRIRIRIYEREREiESERVVVVVVVVVVVVVVVRERERERMAgAMRERFVVVVVVVVVVVVVVVVVERERERFVVVVVVVVVUAVVUREhERERERERIiEhFVVVVVVVVVVVVVVVVVURERETMzMzERERVVVVVVVVVVVVVVVVVVERERFVVVVVVVVVVQAAVVEREREiEiERERERIRVVVVVVVVVVVVVVVVVVURERERETERERFVVVVVVVVVVVVVVVVVVVURFVVVVVVVVVVQAAAFVVERERERIRERERIRFVVVVVVVVVVVVVVVVVVVERERERExEREVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVWQBVVRESECAREhEhERIVVVVVVVVVVVVVVVVVVVVRERERERMRERVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAAAAVVVRIRIRIRERERERVVVVVVVVVVVVVVVVVVVVUREREBETERFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUAAFVVVREhASERESERFVVVVVVVVVVVVVVVVVVVVVERERFVExFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAABVVVVVUREREiEVVVVVVVVVVVVVVVVVVVVVVVVRERERVVZVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVURERERVWVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVEREREVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVRERERFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVURERERVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVERERFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVREREVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUYERVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVURFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUUVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVFVVVVVVVVVVVVVVVVVVVVVVVREREBVVVVVVVVVVVVVVUAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVRVVVVVVVVVVVVVVVVVVVVVVVERERgRVVVVVVVVVVVVVVAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUVVVVVVVVVVVVVVVVVVVVVVVRERERFVVVVVVVVVVVVVVQAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVFVVVVVVVVVVVVVVVVVVVVVVVRERERVVVVVVVVVVVVVVUAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVRVVVVVVVVVVVVVVVVVVVVVVVVRERFVVVVVVVVVVVVVVVAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUVVVVVVVVVVVVVVVVVVVVVVVVVREVVVVVVVVVVVVVVVVQAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAABAAAVVVVVVVVVVVVVVVVVVVVVVVWVVVVVVVVVVVVVVVVUAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQAAAAQAAAAFVVVVVVVVVVVVVVVVVVVVVlVVVVVVVVVVVVVVVVAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQAABVVUVVUAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAAVVVVUVVVVVAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUABVVVURERVVVVAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQAFVVVRERERVVVVAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAAVVVVEBEREBFVVVAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQBVVREREREREREVVVAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAAVVEREREREREREVVQAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQAFURERERERERERFVUABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUABVERERERgRERERVVAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAAVREREREREREREVVQAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQAFVRERERERERERFVUABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQBVURERERERERERVVAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUABVUREREQERERFVUABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUABVURERFREREVVQAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUABVVVVVVVVVVVAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUABVVVVVVVVVUABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUAAAVVVVVVAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQAAAAAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVBQVVVVVVVVVVVVVVVVVVVVVVVVVVAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQUFVVVVVVVVVVVVVVVVVVVVVVVVVQAAAFVVVVVVAAAAAAVVVVVVAAAAVVVVVVUAAAAABVVVUAAAAABVVVVVVQAFAAAFVVVQAAAAAAVVVVVVAAAAVVUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAA=","quests":[{"name":"A STUDENT'S SONG","key":"pipe","max":3,"bits":2,"hints":["SEE THE WOODCUTTER","TAKE PIPE TO CODA"]},{"name":"THE LIGHTHOUSE","key":"lamp","max":5,"bits":3,"hints":["SAIL TO LIGHTHOUSE","SHARDS TO SMITH","LENS TO THE KEEPER","THE KEEPER'S GIFT"]},{"name":"THE WINTER HYMN","key":"hymn","max":5,"bits":3,"hints":["ASK THE HUNTER","HERMIT, EAST ISLET","HYMN TO FERMATA","THE CHOIR'S GIFT"]},{"name":"CASSIUS'S PENANCE","key":"locket","max":4,"bits":3,"hints":["CASSIUS AT WITCH'S","LOCKET TO MOURNER","BACK TO CASSIUS"]},{"name":"A FORGOTTEN NAME","key":"name","max":3,"bits":2,"hints":["SERENADE'S PRIEST","TELL CODA MAESTRO"]}],"ngpMax":5,"mst":{"step":2000,"cap":63,"ptsMax":63,"mpCap":45,"mpPick":3},"ruins":["OLD SHRINE","STANDING STONES","OLD WATCHTOWER","FROZEN SHRINE","ORGAN PIPES","RUINED CHAPEL","FALLEN COLUMNS","OLD GRAVEYARD"],"npcFlags":{"CHAPEL_PILGRIM.MET":0,"LARGO_MINSTREL.GIFT1":1,"CODA_TRAVELLER.GIFT1":8,"CODA_LANTERNGIRL.GIFT1":9,"CODA_BUOYKEEPER.GIFT1":10},"city":[[64,78],[100,66],[56,24],[22,58]],"cityW":5,"cityH":4,"scene":[[40,11,11],[86,17,4],[88,17,4],[40,22,3],[64,27,11],[113,48,2],[115,48,2],[73,56,1],[75,56,1],[9,57,5],[11,57,5],[74,58,1],[107,59,11],[28,60,13],[41,63,0],[6,66,11],[99,68,12],[112,70,8],[112,71,8],[110,73,9],[114,73,10],[60,76,10],[57,77,8],[57,78,8],[59,78,9],[24,80,14],[11,85,7],[13,85,7],[63,86,11],[12,87,7],[57,110,6],[63,110,6],[60,118,15]],"rescueR":3,"oldExit":[[1,100,70],[3,27,62]],"isles":[{"cid":4,"name":"BUOY ISLE","patch":{"x0":10,"y0":106,"w":11,"h":10,"cells":".,,,,,,,,,.,,sssssss,,,ssffgggss,,ssgfgfgs,,,,ssgggss,..,,ssgss,,...,,sss,,.....,,s,,.......,s,........,,,...."},"quest":{"name":"THE BELL BUOY","done":3,"hints":["CLAPPER AT LARGO","CLAPPER TO KEEPER"]}},{"cid":5,"name":"GULL ROCK","patch":{"x0":14,"y0":32,"w":9,"h":9,"cells":".,,,,,...,,sss,,..,ssggs,,.,sgggfs,.,,sggss,..,,sgs,,...,,s,,.....,s,......,,,..."},"quest":{"name":"A GULL'S LETTER","done":3,"hints":["SISTER IN FERMATA","REPLY TO GULL ROCK"]}},{"cid":7,"name":"BELLSTONE","patch":{"x0":111,"y0":28,"w":11,"h":11,"cells":"..,,,,,,,...,,sssss,,.,,sgggggs,,,sgggggggs,,sgggggggs,,,sgggggs,,.,,sgggs,,...,,sgs,,.....,,s,,.......,s,........,,,...."},"quest":{"name":"THE SINGING STONES","done":4,"hints":["WAKE NOON STONE","WAKE DUSK STONE","BACK TO THE SHRINE"]}},{"cid":8,"name":"CHOIR ISLE","patch":{"x0":79,"y0":35,"w":11,"h":11,"cells":"..,,,,,,,,..,,ssssss,,,,sgggggss,,sggggggfs,,sgggggggs,,sfggggggs,,,sgggggs,,.,,ssgss,,...,,,s,,,......,s,........,,,...."},"quest":{"name":"THE LOST CANTOR","done":3,"hints":["ASK IN SERENADE","HERB FOR THE GRAVE"]}},{"cid":6,"name":"EMBER ISLE","patch":{"x0":112,"y0":97,"w":10,"h":10,"cells":"..,,,,,,...,,ssss,,.,,sgffgs,,,sgggggss,,sggggfgs,,,sgggggs,.,,ssgss,,..,,,s,,,.....,s,.......,,,..."},"quest":{"name":"THE BELL FORGE","done":2,"hints":["BRING BRONZE SWORD"]}},{"cid":9,"name":"HOLLOW KEY","patch":{"x0":27,"y0":94,"w":10,"h":11,"cells":"..,,,,,....,,sss,,..,,sssss,,.,sggggss,,,sggggggs,,,sgfgggs,.,sggffs,,.,,sggs,,...,,s,,,.....,s,.......,,,...."},"quest":{"name":"THE MARIGOLD'S LOG","done":3,"hints":["SEARCH THE TOWER","DIG AT THE CAIRN"]}}],"ngq":{"pool":[{"type":"FETCH","mincyc":1,"name":"THE SILVER BOWL","tgtFrom":0},{"type":"FETCH","mincyc":1,"name":"A HYMNAL LOST","tgtFrom":0},{"type":"FETCH","mincyc":2,"name":"THE FROZEN FLUTE","tgtFrom":0},{"type":"FETCH","mincyc":3,"name":"THE MANOR KEYS","tgtFrom":0},{"type":"PLAY","mincyc":1,"name":"A DUET AT DUSK","tgtFrom":0},{"type":"SLAY","mincyc":2,"name":"NOONDAY BOUNTY","tgtFrom":0},{"type":"SLAY","mincyc":4,"name":"LICHO'S BOUNTY","tgtFrom":0},{"type":"SLAY","mincyc":1,"name":"THE WILLOW STRZYGA","tgtFrom":0},{"type":"SLAY","mincyc":1,"name":"A BIES IN THE SNOW","tgtFrom":0},{"type":"SLAY","mincyc":2,"name":"THE DROWNED BRIDE","tgtFrom":0},{"type":"SLAY","mincyc":3,"name":"THE CZART'S HORNS","tgtFrom":0},{"type":"DELIVER","mincyc":1,"name":"LETTER TO LARGO","tgtFrom":0},{"type":"DELIVER","mincyc":1,"name":"A WARM SHAWL","tgtFrom":0},{"type":"DELIVER","mincyc":1,"name":"FLOWERS FOR GRAVES","tgtFrom":0},{"type":"DELIVER","mincyc":2,"name":"THE STAR CHART","tgtFrom":0},{"type":"DELIVER","mincyc":1,"name":"THE KEEPER'S TEA","tgtFrom":1},{"type":"DELIVER","mincyc":2,"name":"NEWS FOR THE KIN","tgtFrom":2},{"type":"PLAY","mincyc":5,"name":"A SONG FOR SAILORS","tgtFrom":5},{"type":"DELIVER","mincyc":4,"name":"THE SMITH'S ORE","tgtFrom":4},{"type":"FIND","mincyc":1,"name":"LOST AT THE SHRINE","tgtFrom":0},{"type":"FIND","mincyc":2,"name":"THE STONE CIRCLE","tgtFrom":0},{"type":"FIND","mincyc":1,"name":"A RUNAWAY","tgtFrom":0},{"type":"FIND","mincyc":3,"name":"THE OLD TUNER","tgtFrom":0},{"type":"FIND","mincyc":4,"name":"GRAVEYARD VIGIL","tgtFrom":0},{"type":"PLAY","mincyc":2,"name":"A LULLABY ASHORE","tgtFrom":0},{"type":"DELIVER","mincyc":1,"name":"SEEDS FOR A FARM","tgtFrom":1}],"titles":["PATRON OF THE ARTS","KEEPER OF SONGS","FRIEND OF LAMPS","VOICE OF WINTER","WARDEN OF ASHES","HEIR OF NOCTURNES","TOWER CONQUEROR"],"arcs":[{"name":"THE LOST SONGBOOK","title":"KEEPER OF SONGS","steps":[{"type":"FIND","what":"THE PAGE BOY","where":""},{"type":"FETCH","what":"SONGBOOK COVER","where":""},{"type":"DELIVER","what":"MENDED BOOK","where":"FERMATA APPRENTICE"},{"type":"PLAY","what":"THE SCHOLAR","where":"IN CODA"}]},{"name":"LIGHTS OF LARGO","title":"FRIEND OF LAMPS","steps":[{"type":"SLAY","what":"","where":""},{"type":"FIND","what":"THE LAMP MAKER","where":""},{"type":"DELIVER","what":"LAMP OIL","where":"LARGO LAMPLIGHTER"},{"type":"PLAY","what":"THE CHILD","where":"IN LARGO"}]},{"name":"THE WINTER CHOIR","title":"VOICE OF WINTER","steps":[{"type":"FETCH","what":"CHOIR BELL","where":""},{"type":"FIND","what":"A LOST SINGER","where":""},{"type":"SLAY","what":"","where":""},{"type":"PLAY","what":"THE PIANIST","where":"IN FERMATA"}]},{"name":"ASHES OF THE MANOR","title":"WARDEN OF ASHES","steps":[{"type":"FETCH","what":"BURNT PSALTER","where":""},{"type":"DELIVER","what":"OLD CANDLE","where":"SERENADE DIGGER"},{"type":"FIND","what":"A WEEPING GHOST","where":""},{"type":"PLAY","what":"THE NUN","where":"IN SERENADE"}]},{"name":"THE TOWER'S ECHO","title":"HEIR OF NOCTURNES","steps":[{"type":"SLAY","what":"","where":""},{"type":"FETCH","what":"STARGLASS","where":""},{"type":"FIND","what":"AN OLD ASTRONOMER","where":""},{"type":"PLAY","what":"THE STARGAZER","where":"IN CODA"}]}],"arcof":[0,0,1,2,3,4],"causes":[{"name":"THE CHURCH ORGAN","thing":"A SECOND ORGAN","town":3},{"name":"THE MUSIC SCHOOL","thing":"A GRAND PIANO","town":0},{"name":"TROUPE VIOLINS","thing":"A CONCERT HARP","town":2},{"name":"THE CHAPEL BELL","thing":"A PEAL OF BELLS","town":0},{"name":"THE TOWER PIANO","thing":"A CLOCKWORK ORGAN","town":1},{"name":"THE HARBOR BELLS","thing":"A SHIP'S CARILLON","town":1},{"name":"THE GLASS CHIMES","thing":"A GLASS HARMONICA","town":2},{"name":"THE CHAPEL HARP","thing":"A GILDED HARP","town":3}],"causeof":[0,0,1,2,3,4],"tier":[500,1500,3000],"dshort":["THE CHAPEL","THE BELLTOWER","CONSERVATORY","THE MANOR","THE TOWER"]},"ngpCodeMax":9,"artN":30,"leadTown":[3,3,0,2,0,1],"artNames":["TOP HAT","POCKET WATCH","METRONOME","QUILL PEN","PLEYEL KEY","NOONDAY LOCK","ANTLER SHED","EVIL EYE BEAD","ZMIJ SCALE","HYMNAL PAGE","SALON CANDLE","SAND'S CIGAR","WHITE GLOVES","RAINDROP LEAF","DELACROIX SKETCH","MAZURKA RIBBON","AMBER BEAD","STORK FEATHER","POLISH SOIL","FIDDLE STRING","RUSALKA VEIL","STAR SHARD","FERN FLOWER","OWL FEATHER","CROWN SPIKE","DEATH MASK","KUPALA WREATH","SKRZAT BUTTON","LUDWIKA'S LETTER","STRZYGA TOOTH"],"bsN":129,"itV15":30,"kindsW":128,"lvY":30,"openY":1,"lvZ":35,"openZ":1,"bw":[["HUSH SLIME",["CODA'S MEADOWS"]],["ECHO BAT",["CODA'S MEADOWS","THE WILLOW WOODS"]],["STATIC WISP",["THE WILLOW WOODS","THE EAST ISLE"]],["RUST KNIGHT",["THE WILLOW WOODS","THE EAST ISLE"]],["MUTE SLIME",["THE EAST ISLE","THE FROST LANDS"]],["DUSK BAT",["THE EAST ISLE","THE FROST LANDS"]],["FROST WISP",["THE FROST LANDS"]],["GRAVE KNIGHT",["THE FROST LANDS","THE DUSK ISLE"]],["VOID SLIME",["THE DUSK ISLE","THE HALL ISLE"]],["DREAD BAT",["THE DUSK ISLE","THE HALL ISLE"]],["SHADE WISP",["THE DUSK ISLE","THE HALL ISLE"]],["NIGHT KNIGHT",["THE HALL ISLE"]],["HOLLOW CHOIR",["WILLOW CHAPEL"]],["BELL WYRM",["SUNKEN BELLTOWER"]],["ICE MAESTRO",["FROST","CONSERVATORY"]],["CASSIUS",["DUSK MANOR"]],["SILENT KING",["HALL OF SILENCE"]],["KELP SLIME",["SUNKEN BELLTOWER"]],["STORM BAT",["SUNKEN BELLTOWER"]],["TIDE WISP",["SUNKEN BELLTOWER"]],["SUNKEN KNIGHT",["SUNKEN BELLTOWER"]],["MOON JELLY",["HOME WATERS"]],["REEF CRAB",["HOME WATERS"]],["SEA SERPENT",["HOME WATERS"]],["INK SQUID",["HOME WATERS"]],["LURE FISH",["HOME WATERS"]],["RIME JELLY",["THE NORTH SEAS"]],["FROST CRAB",["THE NORTH SEAS"]],["RIME SERPENT",["THE NORTH SEAS"]],["RIME SQUID",["THE NORTH SEAS"]],["LAMP FISH",["THE NORTH SEAS"]],["GLOOM JELLY",["THE WEST SEAS"]],["KING CRAB",["THE WEST SEAS"]],["DEEP SERPENT",["THE WEST SEAS"]],["KRAKEN",["THE WEST SEAS"]],["GLOOM ANGLER",["THE WEST SEAS"]],["POLUDNICA",["THE NOCTURNE TOWER","5F, NEW GAME+"]],["LESZY",["THE NOCTURNE TOWER","10F, NEW GAME+"]],["LICHO",["THE NOCTURNE TOWER","15F, NEW GAME+"]],["ZMIJ",["THE NOCTURNE TOWER","20F, NEW GAME+"]],["CZARNOBOG",["THE NOCTURNE TOWER","21F, NEW GAME+"]],["STRZYGA",["THE NOCTURNE TOWER","DAWN FLOORS"]],["UTOPIEC",["THE NOCTURNE TOWER","DAWN FLOORS"]],["RUSALKA",["THE NOCTURNE TOWER","DAWN FLOORS"]],["MOON MOTH",["THE NOCTURNE TOWER","DAWN FLOORS"]],["BIES",["THE NOCTURNE TOWER","DUSK FLOORS"]],["NIGHT OWL",["THE NOCTURNE TOWER","DUSK, DUSK ISLE"]],["GRAVE SPIDER",["THE NOCTURNE TOWER","DUSK FLOORS"]],["DROWNED BRIDE",["THE NOCTURNE TOWER","DUSK FLOORS"]],["INK WRAITH",["THE NOCTURNE TOWER","NIGHT, HALL ISLE"]],["STRZYGON",["THE NOCTURNE TOWER","NIGHT FLOORS"]],["MOON OWL",["THE NOCTURNE TOWER","NIGHT, HALL ISLE"]],["STAR MOTH",["THE NOCTURNE TOWER","NIGHT FLOORS"]],["SCORE WRAITH",["THE NOCTURNE TOWER","MIDNIGHT FLOORS"]],["CZART",["THE NOCTURNE TOWER","MIDNIGHT FLOORS"]],["TOPIELEC",["THE NOCTURNE TOWER","MIDNIGHT FLOORS"]],["WIDOW SPIDER",["THE NOCTURNE TOWER","MIDNIGHT FLOORS"]]],"farA":{"j":[211,218,225],"b":["ncHU1f/3sdD9n63X7J+PvNeR/LbRhZCpu7vrkLOv74Gn0fSf9tXE+I/M24Wht53rwunQ+cKixOT/yKzV4Mqtiu7GpP/Wp+n9tan8jaff3uuZvcro6q/B8/+XvLee7Y7sx7eFk7reutHa443F0dDvjbPd5Zmlp/KAi7fM5ujPwuyKr6D7yLKR9Yzn2NiO5P611/2EqNjp5La32POG0KOO6sasgI76gP3SpZiyhYONtdblnNyt+Yqr08T6lrHdg+y5w/GEmLTT+4KnqYT1v9PHm5emwuiGrsWDkvma8NO7ieeGqo7dzv+R0cn5jaTWv/6cut+XvsrkzKCzmf3H8MO89Oq4ot//m7ix4Y3IxuPyjLjY8vLBqPOMpN7O9pC8y+WHoaPi+Ja7tMO7he+f4quU/Ja1n+qKq43n6t682bLOoIWmzKb9vP7RvYqs2+WMkP/No4H+yLnFqJDj96O384OgqeOCs6m65J21y4uZsMfM6IrUv5LuyqiE+f6f99u3zaCZm8/bv/GSscHrmcjK5J+IsdOTlqLNhejDqtP99bDK4IXGxe/olLPG6PTL/Mynrdy6lryWrZnlyLHDl4PXweqYydDqif2t3/udq6mE57a32ZmTvsDkmKK+gZ3717WH74370qqGnPnDp9Oim5XJ2b3ukLjUkIytxu2P/Ne6wbqKrM60huHpmrWR/cLrmvDM2PyY8dK5g6rIqsGfu/aQpa/riKvGi52wmOHDoI7xh+7vobXt8aTF7+ehwM3v/6ay7Ym60uqBj6O1mPPNq4fl2s683LiH4sSvlKaNj4alyA==","yJKZosKEkpGuzP2XvcKJlabBv5aMr7P6g62l8fCJrd6Tl6ze4ubN3O/QsNLu3qqO9MHE+pjk1KCO7J/iq5T8lqCf+N6vxPP72rud98vuxbb+7IbYw/yUztntgKTfy/iEt9Xj6Mumw9u6jPDc74XnhpeouLr0m6PP5+iq0Nj9l8yz5ISuwomSkbXflZvNoJmbz9u/7p+xseqZp9Ls+pjZ1Pacodjuiqa7yZr50O3JqJLmzp2zmbTlhq6o9o6ev9LhkqTI+Oej09HvjLqoj5igwubtjrXZ8/Gnworp0qKw4vSn2Ojqs83l+5a3wfqKvquK4YKY+8Oxn67CpsXW1/n5u9z/g73C6I3k28z8lqqh+omtx73znr2zgvu1qfmdirbf8JXNxeHktbbemIG7y+nryqH09Z/XwPiKrqjmipC1y4zzhOXP54Lo8Nq0kL6PuIHjg6O1lf7G8Z3ixqKR3bCIi9/Lj56vwYHtnrnGko6i2vGGst+2laCZ64uskOfrnLGT8sKpyKuUnPKguuGaqqzqjqzJz52E1Nf8gq3L5p3w28L7lc3J5oq1scmfhtLZ44Clxpqdrp/xkbqC7MDirIn30fOC4t+pgKOyi4XZyY2YocODk5W/2/jxvMLmgsDTvuqettzhmcfQ6f+P2Mbiiq3CnOOtvMKXnKGugPDHrq/h9a2x44i+p/KIl7K44pqgwOzkz6LJ8pLU0uaEodeYn//ZuZPlzevVsIiY+tuhga2A+buv+5+Ov9GRm6XM4JCLs86U/9LD75DExt/2nd6oj66M59els9r10b2B/IiRqrq89Jm83vqPq8iDkuuluentuMHj47Oyz+Oc1t2LiqDRy/WYpMqS4cikhO7+zKiVt4H426+G87+W5qm99em4xPbtk7e2/JbN3u+BwarS/JDQo46drsaA7p+2tP6crMnr+P+I8NOh0K6KqIKhrZn0xc/ykQ==","u9/O/5HRyv6brqLM+ZjUv+uWyNPshP66yvaauM3wlcGsv86/kbHDoobg0Mz8m+Tcu4iq06yTke7fvciv2KGDo9PSr4P8nKuK+9HirZn41buV6Yjr1Nyy4Pqh2ursrsjsjZK0tZjzjO7JsYeRvNC408Tlj8fX9feXtLX2hq3FnOOkqMn89KLB5Y/Fy72Q6au/6+++z+HhnKnZ5oHPw/uUptLEmPvW88uqnODMn7WXtueYqKrolrO7yeHv0sv5mq2j8/KUsLT4h8mklZ/zp7vim7Wt5oa31b73kbLa++7FpMGlvI7y2vGB5YiRqrq8/IC23uSEoKTy6pqqt57/saX94bS135eSuNz4nMXM1vuRorGc74Tuw6mq2/fDt52s3a6GoPvVooax3a6J9pifvZX6k7+LquutkoTvn6bQo52UytiC65W+1/TupM6FhJCpy5aAtcz55cij6tO91fXdrYfig6Wznv7ats77xKSbmvib+sLNgZHFwvP3nrbRkoCqqeOVpbPT+ZPToomEpM/P7/mi3JCdv9OEjouvopWhhvSJqoLt7cn3hOTa64fw1p3wycufi8/e74HBtd7ogdLK/punzeTu+Nu2ku7EqJLirJX90/OB+M+0kPK+zLCa4crsm+PUoa+e5JSimurR5cqe8NX2keXZ6rPM5J6etsP9lsvahpSyuNn8/dOim5XJ2b3vnKKz+ZXK0OyOkr66mfC7xOzmptbY9J661pTry6WNn+nZ98GkhOzGp5WNuZTlr6P367LL5Z2Nv93li8vG7IWXqLua8b7I/eejwNP+88+yzamI8sau/ZX5lIWmzoiAtLrS8Ji0sP6eptaGzfvM05Dj3NSKmMKp0vL0tdv4g8XR2v3+pbPyiLnT7YCMorqZ8MyshubUsL3fuYDjx66bp46OgdXNkYCs3vWLr97U/vW22v+CxK+C+Iyy2viArKjtg42x1viatd6Q55Do+8n41rLAqsm1geztp8rp"]}};
function makeTaleCore(D) {
  "use strict";
  var A = D.alphabet, ITEMS = D.items, IT_COUNT = ITEMS.length, FL = D.flags, QUESTS = D.quests;
  var FL_MASK = 0;
  Object.keys(FL).forEach(function (k) { FL_MASK |= FL[k]; });
  var SALT = [];
  for (var i = 0; i < D.salt.length; i++) SALT.push(D.salt.charCodeAt(i));
  var KW = D.kindsW || 128;
  var KINDS = (function () {
    var bin = atobPortable(D.kindsB64), out = new Uint8Array(KW * 128);
    for (var j = 0; j < bin.length; j++) {
      var b = bin.charCodeAt(j);
      out[2 * j] = b >> 4;
      out[2 * j + 1] = b & 15;
    }
    return out;
  })();
  function atobPortable(s) {
    if (typeof atob === "function") return atob(s);
    return Buffer.from(s, "base64").toString("binary");
  }
  function Bad(msg) { this.message = msg; this.name = "Bad"; }
  function crc16(bytes) {
    var c = 0xFFFF;
    for (var i = 0; i < bytes.length; i++) {
      c ^= bytes[i] << 8;
      for (var k = 0; k < 8; k++) {
        c = (c & 0x8000) ? ((c << 1) ^ 0x1021) : (c << 1);
        c &= 0xFFFF;
      }
    }
    return c;
  }
  function Writer() { this.bits = []; }
  Writer.prototype.put = function (v, n) {
    if (!(v >= 0 && v < Math.pow(2, n) && Math.floor(v) === v)) throw new Bad("value " + v + " does not fit " + n + " bits");
    for (var i = n - 1; i >= 0; i--) this.bits.push(Math.floor(v / Math.pow(2, i)) & 1);
  };
  Writer.prototype.vari = function (v, top) {
    if (v === 0) this.put(0, 2);
    else if (v < 64) { this.put(1, 2); this.put(v, 6); }
    else if (v < 1024) { this.put(2, 2); this.put(v, 10); }
    else { this.put(3, 2); this.put(v, top || 16); }
  };
  Writer.prototype.small = function (v) {
    if (v === 0) this.put(0, 1);
    else { this.put(1, 1); this.put(v, 6); }
  };
  function Reader(syms) {
    this.bits = [];
    for (var i = 0; i < syms.length; i++)
      for (var b = 4; b >= 0; b--) this.bits.push((syms[i] >> b) & 1);
    this.pos = 0;
  }
  Reader.prototype.get = function (n) {
    if (this.pos + n > this.bits.length) throw new Bad("the code ends too early");
    var v = 0;
    for (var i = 0; i < n; i++) { v = v * 2 + this.bits[this.pos]; this.pos++; }
    return v;
  };
  Reader.prototype.vari = function (top) {
    var c = this.get(2);
    return c === 0 ? 0 : this.get([6, 10, top || 16][c - 1]);
  };
  Reader.prototype.small = function () { return this.get(1) ? this.get(6) : 0; };
  var WEAPONS = [], ARMORS = [];
  ITEMS.forEach(function (it, i) { if (it.kind === "IK_WEAPON") WEAPONS.push(i); else if (it.kind === "IK_ARMOR") ARMORS.push(i); });
  var MST = D.mst;
  var IT_V15 = D.itV15 || IT_COUNT;
  function newItems(f) {
    return f.weapon >= IT_V15 || f.armor >= IT_V15 || (f.bag || []).some(function (e) { return e[0] >= IT_V15; });
  }
  function kindOf(id) { return id > 0 && id < IT_COUNT ? ITEMS[id].kind : ""; }
  function isGear(id) { var k = kindOf(id); return k === "IK_WEAPON" || k === "IK_ARMOR" || k === "IK_KEY"; }
  function checkFile(f, ver) {
    function need(ok, what) { if (!ok) throw new Bad(what); }
    if (ver === undefined) ver = verOf(f);
    need(f.lv >= 1 && f.lv <= lvTop(f, ver), "LV must be 1 to " + lvTop(f, ver) + (lvTop(f, ver) > D.maxLv ? "" : " (" + (D.lvX || D.maxLv) + " with the extra map flag and the PASSAGE flag)"));
    need(f.xp >= 0 && f.xp <= 0xFFFF, "XP must be 0 to 65535");
    need(f.hp >= 1 && f.hp <= 255, "HP must be 1 to 255");
    need(f.mp >= 0 && f.mp <= 255, "MP must be 0 to 255");
    need(f.gold >= 0 && f.gold <= D.maxGold, "gold must be 0 to " + D.maxGold);
    need(f.pieces >= 0 && f.pieces < 16 && f.saved >= 0 && f.saved < 16, "pieces and guardians are 4 bits");
    need((f.flags & ~FL_MASK) === 0, "unknown story flag bits");
    ["x", "y", "ship_x", "ship_y"].forEach(function (k) {
      var lim = ((ver >= 12 && (k === "x" || k === "ship_x")) || ver >= 14) ? 256 : 128;
      need(f[k] >= 0 && f[k] < lim, k + " must be 0 to " + (lim - 1));
    });
    need((f.last_town >= 0 && f.last_town < D.towns.length) || (ver >= 13 && f.last_town === 28), "unknown town");
    need(f.weapon === 0 || kindOf(f.weapon) === "IK_WEAPON", "the weapon slot holds something that is not a weapon");
    need(f.armor === 0 || kindOf(f.armor) === "IK_ARMOR", "the armor slot holds something that is not armor");
    ["b_atk", "b_def", "b_hp"].forEach(function (k) { need(f[k] >= 0 && f[k] <= 63, k + " must be 0 to 63"); });
    need(f.chests.length === 4 && f.chests.every(function (c) { return c >= 0 && c <= 0xFFFF; }), "chests");
    need(f.houses >= 0 && f.houses < 256, "cottages");
    need(f.bag.length <= D.bagSlots, "the bag has " + D.bagSlots + " slots");
    f.bag.forEach(function (e) {
      need(e[0] > 0 && e[0] < IT_COUNT, "unknown item in the bag");
      need(e[1] >= 1 && e[1] <= 9, "bag counts are 1 to 9");
      need(e[1] === 1 || !isGear(e[0]), ITEMS[e[0]].name + " does not stack");
    });
    var q = f.quest || [];
    need(q.length === QUESTS.length, "the side quests need " + QUESTS.length + " stages");
    q.forEach(function (v, k) { need(v >= 0 && v <= QUESTS[k].max, QUESTS[k].name + " stage must be 0 to " + QUESTS[k].max); });
    var c = f.ngp || 0, xb = f.xb || [0, 0, 0, 0], cmax = ver >= 9 ? D.ngpMax : D.ngpCodeMax;
    need(c >= 0 && c <= cmax && Math.floor(c) === c, "NEW GAME+ cycle must be 0 to " + cmax);
    need(xb.length === 4 && xb.every(function (v) { return v >= 0 && v < 256 && Math.floor(v) === v; }), "flag bytes are 0 to 255");
    var m = f.mst || 0, pq = f.pq || [];
    need(m >= 0 && m <= 255 && Math.floor(m) === m, "MASTERY POINTS earned must be 0 to 255");
    var u = f.mpts || 0, bm = f.b_mp || 0;
    need(u >= 0 && u <= MST.ptsMax && Math.floor(u) === u, "unspent MASTERY POINTS must be 0 to " + MST.ptsMax);
    need(bm >= 0 && bm <= MST.mpCap && bm % MST.mpPick === 0, "the MAX MP bonus must be a multiple of " + MST.mpPick + ", 0 to " + MST.mpCap);
    need(m || !(u || bm), "unspent points and a MAX MP bonus need MASTERY POINTS earned");
    if (ver >= 5) {
      var base = D.levels[f.lv - 1][0];
      need(f.xp >= base && f.xp <= base + 2047, "XP must be " + base + " to " + (base + 2047) + " at LV " + f.lv +
           (f.lv === lvTop(f) ? " (every " + MST.step + " XP past " + base + " is a MASTERY POINT)" : ""));
      need(f.mp <= (ver >= 15 ? 255 : 127), "MP must be 0 to " + (ver >= 15 ? 255 : 127));
    } else {
      need(!(u || bm), "unspent points and a MAX MP bonus need a version 5 code");
    }
    var tw = f.tw || 0;
    need(tw >= 0 && tw <= (ver >= 8 ? 0xFF : 0x7F) && Math.floor(tw) === tw, "the tower: checkpoint 0-3, artifacts 0-31");
    if (ver >= 6) need(!tw || (f.ngp || 0) >= 1, "the tower is NEW GAME+ only (a journey from NEW GAME+1)");
    else need(!tw, "the tower needs a version 6 code");
    need(pq.length <= (ver >= 8 ? 8 : 4), "at most " + (ver >= 8 ? 8 : 4) + " island quests in progress travel in a code");
    pq.forEach(function (e) {
      need(e[0] >= 1 && e[0] <= 63 && e[1] >= 1 && e[1] <= 7, "island quest: content id 1 to 63, stage 1 to 7");
    });
    need(pq.every(function (e, i) { return pq.findIndex(function (o) { return o[0] === e[0]; }) === i; }), "one island quest once");
    var qd = f.qd || 0, sh = f.twsh || 0;
    if (ver >= 7) {
      need(qd >= 0 && qd <= 0xFFFFFFFF && Math.floor(qd) === qd, "the island quests done: 32 bits");
      need(sh >= 0 && sh < 0x200000 && Math.floor(sh) === sh, "the pianos' sheets: 21 bits");
      need(!sh || (f.ngp || 0) >= 1, "the tower is NEW GAME+ only (a journey from NEW GAME+1)");
      need(pq.every(function (e) { return !(e[0] <= 32 && qdHas(qd, e[0])); }), "a quest that is done is not also in progress");
      need(f.bag.every(function (e) { return e[0] !== D.itSextant && e[0] !== D.itSheets; }), "key items are not in the bag (version 7)");
    } else {
      need(!qd && !sh, "island quests done / piano sheets need a version 7 code");
    }
    var g = v8of(f), ng = (f.ngp || 0) >= 1;
    function int(v, lo, hi) { return Math.floor(v) === v && v >= lo && v <= hi; }
    if (ver >= 8) {
      need(g.quest_rsv.length === 3 && g.quest_rsv.every(function (v) { return int(v, 0, 255); }), "record bytes 56-58 are 0 to 255");
      need(int(g.minutes, 0, ver >= 9 ? 15 : 65535), ver >= 9 ? "the play clock carries its day phase, 0 to 15" : "the play clock is 0 to 65535 minutes");
      need(int(g.mroom, 0, ALL21), "the MUSIC ROOM: 21 nocturnes");
      need(int(g.twc, 0, ALL21), "the tower's chests: 21 floors");
      need(g.ngq.length === 8 && g.ngq.every(function (v) { return int(v, 0, 31); }), "the journey's quests: 8 slots of 5 bits");
      need(int(g.narc, 0, 16) && int(g.narcx, 0, 7), "the arc: step and stage 0-16, dungeon 0-7");
      need(int(g.ndon, 0, 3) && int(g.npl, 0, 255) && (g.npl & ~0xCF) === 0, "the cause: tier 0-3, pledges bits 0-3, asked, auction");
      need(int(g.ttl, 0, 127), "TITLES: 7 bits");
      need(ng || !(g.twc || g.ngq.some(Boolean) || g.narc || g.narcx || g.ndon || g.npl || g.ttl),
           "the tower's chests, the journey's quests, arc, cause and TITLES are NEW GAME+ only");
    } else {
      need(JSON.stringify(g) === JSON.stringify(v8of({})), "the clock, MUSIC ROOM, tower chests, journey quests, arc, cause and TITLES need a version 8 code");
    }
    if (f.best !== undefined) {
      bestBits(f.best);
      need(ver >= 10 || !bestCount(f), "the bestiary needs a version 10 code");
    }
    if (f.x8 !== undefined || f.ever !== undefined) {
      need(f.x8 === undefined || f.x8 === 0 || f.x8 === 1, "an extra map flag: 0 or 1");
      need(f.ever === undefined || (f.ever >= 0 && f.ever <= (ver >= 13 ? 63 : 31)), "the EVER DONE marks: 5 bits (version 13: 6)");
      need(ver >= 12 || !(f.x8 || f.ever), "the extra map flag and the EVER DONE marks need a version 12 code");
    }
    if (f.xq !== undefined || f.xd !== undefined || f.xbe !== undefined) {
      need(ver >= 13, "the far-shore block needs a version 13 code");
      var q = f.xq || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], d = f.xd || [0, 0, 0, 0, 0, 0];
      need(q.length === 10 && q.every(function (v) { return v >= 0 && v < 256 && Math.floor(v) === v; }), "xq: 10 bytes");
      need(q[0] <= 10 && !(q[4] & ~0x3F) && !(q[5] & ~0x7F) && !(q[6] & ~0x1F) && !(q[7] & ~0x1C) && !q[8] && !(q[9] & 0x1F), "xq: the field sizes");
      need((q[9] >> 5) <= 6 && (ver >= 15 || !q[9]), "xq[9]: the first journey there + 1 (0-6), version 15 only");
      need(d.length === 6 && d.every(function (v) { return v >= 0 && v < 256 && Math.floor(v) === v; }), "xd: 6 bytes");
      need(!((d[0] | d[1] << 8) & ~0x777) && !((d[2] | d[3] << 8) & ~0x7777) && !(d[4] & ~0x7F) && !(d[5] & ~0x0F), "xd: the field sizes");
      bitsOf(f.xbe, XBE_N);
    }
    var y15 = v15of(f);
    if (ver >= 15) {
      var q2 = y15.yq, d2 = y15.yd, q3 = y15.zq, d3 = y15.zd;
      need(Math.floor(y15.pt) === y15.pt && y15.pt >= 0 && y15.pt <= PT_MAX, "the play time is 0:00 to 999:59");
      need(y15.yg === 0 || y15.yg === 1, "a gate bit: 0 or 1");
      need(q2.length === 14 && q2.every(byteOk) && (q2[0] & 15) <= 10 && ((q2[12] >> 4) & 7) <= 6, "yq: 14 bytes, the field sizes");
      need(d2.length === 6 && d2.every(byteOk) && !(d2[3] & 0xC0), "yd: 6 bytes, 30 chest bits");
      need(q3.length === 10 && q3.every(byteOk) && (q3[1] & 15) <= 12 && (q3[1] >> 5) <= 6, "zq: 10 bytes, the field sizes");
      need(d3.length === 6 && d3.every(byteOk) && !(d3[3] & 0xC0), "zd: 6 bytes, 30 chest bits");
      bitsOf(f.ybe, YBE_N); bitsOf(f.zbe, ZBE_N);
      need(int(y15.yc, 0, 127) && int(y15.zc, 0, 127), "the far causes: 0 to 127 each");
      need(f.lv <= D.levels.length, "LV must be 1 to " + D.levels.length);
    } else {
      need(!(y15.pt || y15.yg || y15.yq.some(Boolean) || y15.yd.some(Boolean) || y15.zq.some(Boolean) || y15.zd.some(Boolean) || y15.yc || y15.zc ||
             bitsOf(f.ybe, YBE_N).some(Boolean) || bitsOf(f.zbe, ZBE_N).some(Boolean)), "the play time and the later far blocks need a version 15 code");
      need(!newItems(f), "that gear needs a version 15 code");
    }
    if (f.chart !== undefined) {
      need(f.chart === 0 || f.chart === 1, "fully charted: 0 or 1");
      need(ver >= 11 || !f.chart, "fully charted needs a version 11 code");
    }
    var h = v9of(f);
    if (ver >= 9) {
      need(h.cdon.length === 4 && h.cdon.every(function (v) { return int(v, 0, 255); }), "the cities' causes: 4 bytes");
      need(!ng || !h.cdon[D.leadTown[c]], "the journey's first cause keeps its own tier and pledges (its city's entry is 0)");
      need(int(h.art, 0, ART_ALL), "the artifacts: 30 bits");
      var wlim = ver >= 15 ? D.artN + 15 : D.artN + 1;
      need(h.aeq.length === 3 && h.aeq.every(function (v) { return int(v, 0, wlim) && (!v || wornHeld(f, h, v - 1, ver)); }),
           "the worn artifacts must be held (id + 1, 0 = none)");
      need(int(h.acos, 0, 2), "the costume is 0 to 2");
      need(ver >= 15 || !(h.aeq.some(Boolean) || h.acos) || (ng && h.art), "worn artifacts need an artifact 0-29 before version 15");
      need(!h.acos || h.art, "a costume needs an artifact 0-29");
      need((h.fin === 0 || h.fin === 1) && (!h.fin || c === D.ngpMax), "COMPLETE is the last journey's");
      need(int(h.twj, 0, Math.pow(2, c + 1) - 1), "the tower's journeys: 0 to this one");
      need(((h.twj >> c) & 1) === ((tw & 0x80) ? 1 : 0), "this journey's tower mark is the tower's cleared bit");
      need(h.ttl1 === ttl1Of(h.art, h.fin), "the second TITLES byte follows the artifacts and COMPLETE");
      need(ng || !(h.cdon.some(Boolean) || h.art || (ver < 15 && h.aeq.some(Boolean)) || h.acos || h.twj), "the causes and the artifacts are NEW GAME+ only");
      need((h.art & 31) === ((tw >> 2) & 31), "artifacts 0-4 are the tower's own bits");
    } else {
      need(JSON.stringify(h) === JSON.stringify(v9of({})), "the cities' causes, artifacts, COMPLETE and tower journeys need a version 9 code");
    }
  }
  var BS_N = 129, BS_GROUPS = [[0, 57], [57, 93], [93, 129]];
  function bestBits(hex) {
    var b = [], s = String(hex || "0");
    for (var i = s.length - 1; i >= 0; i--) {
      var v = parseInt(s.charAt(i), 16);
      if (isNaN(v)) throw new Bad("the bestiary is a hex string");
      for (var k = 0; k < 4; k++) b.push((v >> k) & 1);
    }
    while (b.length < BS_N) b.push(0);
    if (b.slice(BS_N).some(Boolean)) throw new Bad("the bestiary has 129 entries");
    return b.slice(0, BS_N);
  }
  function bestHex(bits) {
    var s = "";
    for (var i = 0; i < bits.length; i += 4) {
      var v = 0;
      for (var k = 0; k < 4; k++) v |= (bits[i + k] || 0) << k;
      s = "0123456789abcdef".charAt(v) + s;
    }
    s = s.replace(/^0+/, "");
    return s || "0";
  }
  function bestCount(f) { return bestBits(f.best).filter(Boolean).length; }
  var XBE_N = 81;
  function bitsOf(hex, n) {
    var b = [], s = String(hex || "0");
    for (var i = s.length - 1; i >= 0; i--) {
      var v = parseInt(s.charAt(i), 16);
      if (isNaN(v)) throw new Bad("a hex string");
      for (var k = 0; k < 4; k++) b.push((v >> k) & 1);
    }
    while (b.length < n) b.push(0);
    if (b.slice(n).some(Boolean)) throw new Bad("too many bits");
    return b.slice(0, n);
  }
  function xbeCount(f) { return bitsOf(f.xbe, XBE_N).filter(Boolean).length; }
  function farJ(f, s) { return s === 0 ? ((f.xq || [])[9] || 0) >> 5 : (((f.yq || [])[13] || 0) >> (s === 1 ? 1 : 4)) & 7; }
  function farFix(f) {
    var n = Math.min(f.ngp || 0, D.ngpMax), lo = 0, done = 0, s;
    var SEAS = [["xbe", 81, 27, 27, 54], ["ybe", 70, 24, 24, 47], ["zbe", 70, 24, 24, 47]];
    for (s = 0; s < 3; s++) {
      var key = SEAS[s][0], mon = SEAS[s][2], o1 = SEAS[s][3], o2 = SEAS[s][4], m = s ? mon - 1 : mon, j = farJ(f, s), k;
      if (j) { lo = j - 1; continue; }
      var b = bitsOf(f[key], SEAS[s][1]);
      var any = function (o, c) { for (var i = 0; i < c; i++) if (b[o + i]) return true; return false; };
      var old = [any(0, mon), any(o1, m), any(o2, m)];
      var ok = s === 0 ? f.x8 : s === 1 ? f.yg : ((f.zq || [])[0] || 0) & 1;
      if (!ok || !(old[0] || old[1] || old[2])) continue;
      if (s === 0 && !old[0]) {
        var t = (f.twj || 0) | ((f.tw || 0) & 0x80 ? 1 << n : 0), c0 = 0;
        if (t) while (!((t >> c0) & 1)) c0++;
        lo = Math.max(c0, 1);
      }
      lo = Math.min(lo, n);
      for (j = lo; j < n; j++) if (old[j === 0 ? 0 : 2 - (j & 1)]) break;
      if (j) {
        for (k = 0; k < m; k++) {
          var v0 = b[k], v1 = b[o1 + k], v2 = b[o2 + k];
          b[o1 + k] = 0; b[o2 + k] = 0;
          if (j & 1 ? v1 : v2) v0 = 1;
          b[k] = v0 ? 1 : 0;
          if (n > j && (j & 1 ? v2 : v1)) b[o1 + k] = 1;
          if (n > j + 1 && (j & 1 ? v1 : v2)) b[o2 + k] = 1;
        }
        var h = bestHex(b);
        if (h === "0") delete f[key]; else f[key] = h;
      }
      if (s === 0) { f.xq = (f.xq || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).slice(); f.xq[9] = (f.xq[9] & 0x1F) | ((j + 1) << 5); }
      else { f.yq = (f.yq || zeros(14)).slice(); f.yq[13] = (f.yq[13] & (s === 1 ? 0xF1 : 0x8F)) | ((j + 1) << (s === 1 ? 1 : 4)); }
      lo = j; done = 1;
    }
    return done;
  }
  var YBE_N = 70, ZBE_N = 70, YBE_GROUPS = [[0, 24], [24, 47], [47, 70]], ZBE_GROUPS = [[0, 24], [24, 47], [47, 70]], PT_MAX = 59999;
  function byteOk(v) { return v >= 0 && v < 256 && Math.floor(v) === v; }
  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }
  function v15of(f) {
    return { pt: f.pt || 0, yg: f.yg || 0, yq: (f.yq || zeros(14)).slice(), yd: (f.yd || zeros(6)).slice(),
             zq: (f.zq || zeros(10)).slice(), zd: (f.zd || zeros(6)).slice(), yc: f.yc || 0, zc: f.zc || 0 };
  }
  function ybeCount(f) { return bitsOf(f.ybe, YBE_N).filter(Boolean).length; }
  function zbeCount(f) { return bitsOf(f.zbe, ZBE_N).filter(Boolean).length; }
  function wornHeld(f, h, i, ver) {
    var b = function (v, k) { return Math.floor(v / Math.pow(2, k)) % 2 === 1; };
    if (i < D.artN) return artHas(h.art, i);
    if (i < D.artN + 5) return ver >= 13 && b((f.xq || [0, 0, 0, 0, 0, 0, 0])[6], i - D.artN);
    if (ver < 15 || i >= D.artN + 15) return false;
    var g = v15of(f);
    if (i < D.artN + 10) return b(g.yq[11], i - D.artN - 5);
    var k = i - D.artN - 10;
    return k === 0 ? b(g.zd[5], 0) : k === 1 ? b(g.zd[5], 1) : k === 2 ? b(g.zq[0], 5) : k === 3 ? (g.zq[3] & 3) === 3 : b(g.zd[5], 2);
  }
  function worn15(f) {
    var h = v9of(f);
    if (h.aeq.some(function (v) { return v > D.artN + 1; })) return true;
    return h.aeq.some(Boolean) && !(f.ngp && h.art);
  }
  function needs15(f) {
    var g = v15of(f);
    return !!(g.pt || g.yg || g.yq.some(Boolean) || g.yd.some(Boolean) || bitsOf(f.ybe, YBE_N).some(Boolean) ||
              g.zq.some(Boolean) || g.zd.some(Boolean) || bitsOf(f.zbe, ZBE_N).some(Boolean) || f.lv > (D.lvX || D.maxLv) ||
              f.mp > 127 || (f.x >= 128 && f.y >= 128) || (f.ship_x >= 128 && f.ship_y >= 128) || newItems(f) || worn15(f) ||
              ((f.xq || [])[9] || 0) >> 5 || f.yc || f.zc);
  }
  function verOf(f) { return needs15(f) ? 15 : (f.y >= 128 || f.ship_y >= 128) ? 14 : D.version; }
  function bytesOptPut(w, a) {
    if (!a.some(Boolean)) { w.put(0, 1); return; }
    w.put(1, 1);
    a.forEach(function (v) { optPut(w, v, 8); });
  }
  function groupsPut(w, b, groups) {
    groups.forEach(function (g) {
      var part = b.slice(g[0], g[1]);
      if (part.some(Boolean)) { w.put(1, 1); part.forEach(function (v) { w.put(v, 1); }); } else w.put(0, 1);
    });
  }
  function dgnPut(w, d) {
    optPut(w, d[0] + d[1] * 256 + d[2] * 65536 + (d[3] & 0x3F) * 16777216, 30);
    optPut(w, d[4], 8);
    optPut(w, d[5], 8);
  }
  function putV15(w, f) {
    var g = v15of(f), b2 = bitsOf(f.ybe, YBE_N), b3 = bitsOf(f.zbe, ZBE_N);
    optPut(w, g.pt, 16);
    if (g.yg || g.yq.some(Boolean) || g.yd.some(Boolean) || b2.some(Boolean)) {
      w.put(1, 1);
      w.put(g.yg, 1);
      optPut(w, g.yq[0], 8);
      bytesOptPut(w, g.yq.slice(1, 11));
      [11, 12, 13].forEach(function (k) { optPut(w, g.yq[k], 8); });
      dgnPut(w, g.yd);
      groupsPut(w, b2, YBE_GROUPS);
    } else w.put(0, 1);
    if (g.zq.some(Boolean) || g.zd.some(Boolean) || b3.some(Boolean)) {
      w.put(1, 1);
      optPut(w, g.zq[0], 8);
      optPut(w, g.zq[1], 8);
      bytesOptPut(w, g.zq.slice(2, 10));
      dgnPut(w, g.zd);
      groupsPut(w, b3, ZBE_GROUPS);
    } else w.put(0, 1);
  }
  function getV15(r, f) {
    function opt(n, what) { if (!r.get(1)) return 0; var v = r.get(n); if (!v) throw new Bad(what + " written as zero"); return v; }
    function bytesOpt(n, what) {
      if (!r.get(1)) return zeros(n);
      var a = [];
      for (var i = 0; i < n; i++) a.push(opt(8, what));
      if (!a.some(Boolean)) throw new Bad(what + " written as zero");
      return a;
    }
    function groups(gs, n, what) {
      var b = zeros(n);
      gs.forEach(function (g) {
        if (!r.get(1)) return;
        var any = 0;
        for (var i = g[0]; i < g[1]; i++) { b[i] = r.get(1); any |= b[i]; }
        if (!any) throw new Bad(what + " group written as zero");
      });
      return b;
    }
    function dgn(what) {
      var c = opt(30, what + " chests");
      return [c & 255, (c >> 8) & 255, (c >> 16) & 255, Math.floor(c / 16777216), opt(8, what + " flags"), opt(8, what + " slots")];
    }
    var pt = opt(16, "the play time");
    if (pt > PT_MAX) throw new Bad("the play time past 999:59");
    if (pt) f.pt = pt;
    if (r.get(1)) {
      var yg = r.get(1), yq = [opt(8, "a far beat")].concat(bytesOpt(10, "far errands"));
      [11, 12, 13].forEach(function () { yq.push(opt(8, "a far row")); });
      var yd = dgn("far"), yb = groups(YBE_GROUPS, YBE_N, "a far bestiary");
      if (!(yg || yq.some(Boolean) || yd.some(Boolean) || yb.some(Boolean))) throw new Bad("a far block written as nothing");
      if (yg) f.yg = 1;
      if (yq.some(Boolean)) f.yq = yq;
      if (yd.some(Boolean)) f.yd = yd;
      if (yb.some(Boolean)) f.ybe = bestHex(yb);
    }
    if (r.get(1)) {
      var zq = [opt(8, "a far flag"), opt(8, "a far beat")].concat(bytesOpt(8, "far errands"));
      var zd = dgn("far"), zb = groups(ZBE_GROUPS, ZBE_N, "a far bestiary");
      if (!(zq.some(Boolean) || zd.some(Boolean) || zb.some(Boolean))) throw new Bad("a far block written as nothing");
      if (zq.some(Boolean)) f.zq = zq;
      if (zd.some(Boolean)) f.zd = zd;
      if (zb.some(Boolean)) f.zbe = bestHex(zb);
    }
  }
  function optPut(w, v, n) { if (v) { w.put(1, 1); w.put(v, n); } else w.put(0, 1); }
  function cpack(c, floors) { var v = 0; for (var fl = floors - 1; fl >= 0; fl--) v = (v << 3) | ((c >> (4 * fl)) & 7); return v; }
  function cunpack(v, floors) { var c = 0; for (var fl = 0; fl < floors; fl++) { c |= (v & 7) << (4 * fl); v >>= 3; } return c; }
  function putFar(w, f) {
    var q = f.xq || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], d = f.xd || [0, 0, 0, 0, 0, 0], be = bitsOf(f.xbe, XBE_N);
    var ru = f.last_town === 28 ? 1 : 0;
    if (!(q.some(Boolean) || d.some(Boolean) || be.some(Boolean) || ru)) { w.put(0, 1); return; }
    w.put(1, 1);
    w.put(q[0], 4);
    optPut(w, q[1], 8);
    var sd = q[2] | (q[3] << 8), cn = q[4] & 0x3F;
    if (sd || cn) { w.put(1, 1); w.put(sd, 16); w.put(cn, 6); } else w.put(0, 1);
    optPut(w, q[5] & 0x7F, 7);
    optPut(w, q[6] & 0x1F, 5);
    optPut(w, (q[7] >> 2) & 7, 3);
    w.put(ru, 1);
    optPut(w, cpack(d[0] | (d[1] << 8), 3), 9);
    optPut(w, cpack(d[2] | (d[3] << 8), 4), 12);
    optPut(w, d[4] & 0x7F, 7);
    optPut(w, d[5] & 0x0F, 4);
    for (var g = 0; g < 3; g++) {
      var part = be.slice(27 * g, 27 * g + 27);
      if (part.some(Boolean)) { w.put(1, 1); part.forEach(function (v) { w.put(v, 1); }); } else w.put(0, 1);
    }
  }
  function getFar(r, f) {
    if (!r.get(1)) return;
    function opt(n, what) { if (!r.get(1)) return 0; var v = r.get(n); if (!v) throw new Bad(what + " written as zero"); return v; }
    var q = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], d = [0, 0, 0, 0, 0, 0], be = [];
    q[0] = r.get(4);
    if (q[0] > 10) throw new Bad("far beats 0 to 10");
    q[1] = opt(8, "far flags");
    if (r.get(1)) { var sd = r.get(16), cn = r.get(6); if (!sd && !cn) throw new Bad("far errands written as zero"); q[2] = sd & 255; q[3] = sd >> 8; q[4] = cn; }
    q[5] = opt(7, "a far cause"); q[6] = opt(5, "a far set"); q[7] = opt(3, "a far rematch") << 2;
    if (r.get(1)) f.last_town = 28;
    var c = cunpack(opt(9, "far chests"), 3); d[0] = c & 255; d[1] = c >> 8;
    c = cunpack(opt(12, "far chests"), 4); d[2] = c & 255; d[3] = c >> 8;
    d[4] = opt(7, "far flags"); d[5] = opt(4, "far slots");
    for (var g = 0; g < 3; g++) {
      var part = [];
      if (r.get(1)) {
        for (var i = 0; i < 27; i++) part.push(r.get(1));
        if (!part.some(Boolean)) throw new Bad("a bestiary group written as zero");
      } else for (var j = 0; j < 27; j++) part.push(0);
      be = be.concat(part);
    }
    if (q.some(Boolean)) f.xq = q;
    if (d.some(Boolean)) f.xd = d;
    if (be.some(Boolean)) f.xbe = bestHex(be);
  }
  var ART_ALL = 0x3FFFFFFF;
  function artHas(art, i) { return Math.floor(art / Math.pow(2, i)) % 2 === 1; }
  function ttl1Of(art, fin) {
    var t = 0;
    for (var s = 0; s < 5; s++) if (((art >> (5 * s)) & 31) === 31) t |= 1 << s;
    if (art === ART_ALL) t |= 32;
    if (fin & 1) t |= 128;
    return t;
  }
  function v9of(f) {
    return { cdon: (f.cdon || [0, 0, 0, 0]).slice(), art: f.art || 0, aeq: (f.aeq || [0, 0, 0]).slice(), acos: f.acos || 0,
             ttl1: f.ttl1 || 0, fin: f.fin || 0, twj: f.twj || 0 };
  }
  function v9Fit(f) {
    if ((f.ngp || 0) > D.ngpMax) {
      f.ngp = D.ngpMax; f.ngq = [0, 0, 0, 0, 0, 0, 0, 0]; f.narc = 0; f.narcx = 0; f.ndon = 0; f.npl = 0; f.cdon = [0, 0, 0, 0];
    }
    var h = v9of(f);
    Object.keys(h).forEach(function (k) { f[k] = h[k]; });
    f.art |= ((f.tw || 0) >> 2) & 31;
    if ((f.tw || 0) & 0x80) f.twj |= 1 << f.ngp;
    f.ttl1 = ttl1Of(f.art, f.fin);
    return f;
  }
  var ALL21 = 0x1FFFFF;
  function v8of(f) {
    return { quest_rsv: (f.quest_rsv || [0, 0, 0]).slice(), minutes: f.minutes || 0, mroom: f.mroom || 0, twc: f.twc || 0,
             ngq: (f.ngq || [0, 0, 0, 0, 0, 0, 0, 0]).slice(), narc: f.narc || 0, narcx: f.narcx || 0, ndon: f.ndon || 0,
             npl: f.npl || 0, ttl: f.ttl || 0 };
  }
  function towerFit(f) {
    var cp = (f.tw || 0) & 3;
    if (cp) f.twc = [0, 0x1F, 0x3FF, 0x7FFF][cp];
  }
  function qdHas(qd, cid) { return Math.floor(qd / Math.pow(2, cid - 1)) % 2 === 1; }
  function keyMigrate(f) {
    var notes = [], sh = f.twsh || 0, n0 = f.bag.length;
    [5, 10, 15, 20, 21].forEach(function (t, k) { if ((f.tw || 0) & (4 << k)) sh |= 1 << (t - 1); });
    if (sh !== (f.twsh || 0)) notes.push("Each tower boss beaten keeps its ARTIFACT and gives its floor's SHEET MUSIC.");
    f.twsh = sh;
    if (f.bag.some(function (e) { return e[0] === D.itSextant; })) { f.xb = f.xb.slice(); f.xb[3] |= 0x20; }
    f.bag = f.bag.filter(function (e) { return e[0] !== D.itSextant && e[0] !== D.itSheets; });
    if (f.bag.length !== n0) notes.push("The SEXTANT / SHEET MUSIC move from the bag to the KEY ITEMS.");
    return notes;
  }
  var CHEST_V6 = [0x777, 0x777, 0x7777, 0x7777];
  function encode(f) {
    var V = verOf(f);
    checkFile(f, V);
    var w = new Writer();
    w.put(V, 4);
    w.put(f.lv, V >= 15 ? 6 : 5); w.put(f.xp - D.levels[f.lv - 1][0], 11); w.put(f.hp, 8); w.put(f.mp, V >= 15 ? 8 : 7); w.put(f.gold, 14);
    w.put(f.pieces, 4); w.put(f.saved, 4); w.put(f.flags, 5);
    var xb = V >= 12 ? 8 : 7, yb = V >= 14 ? 8 : 7;
    w.put(f.x, xb); w.put(f.y, yb); w.put(f.ship_x, xb); w.put(f.ship_y, yb);
    w.put(f.last_town < D.towns.length ? f.last_town : 0, 2); w.put(f.weapon ? WEAPONS.indexOf(f.weapon) + 1 : 0, 4); w.put(f.armor ? ARMORS.indexOf(f.armor) + 1 : 0, 4);
    w.small(f.b_atk); w.small(f.b_def); w.small(f.b_hp);
    f.chests.forEach(function (c, d) {
      c &= CHEST_V6[d];
      if (c) { w.put(1, 1); for (var fl = 0; fl < (d < 2 ? 3 : 4); fl++) w.put((c >> (4 * fl)) & 7, 3); }
      else w.put(0, 1);
    });
    w.put(f.houses, 8);
    w.put(f.bag.length, 4);
    f.bag.forEach(function (e) { w.put(e[0], V >= 15 ? 6 : 5); w.put(e[1], 4); });
    f.quest.forEach(function (v, k) { w.put(v, QUESTS[k].bits); });
    var g = v8of(f);
    function opt21(v) { if (v) { w.put(1, 1); w.put(v & 255, 8); w.put((v >> 8) & 255, 8); w.put(v >> 16, 5); } else w.put(0, 1); }
    if (g.quest_rsv.some(Boolean)) { w.put(1, 1); g.quest_rsv.forEach(function (v) { w.put(v, 8); }); } else w.put(0, 1);
    w.put(f.ngp || 0, 4);
    (f.xb || [0, 0, 0, 0]).forEach(function (v) { if (v) { w.put(1, 1); w.put(v, 8); } else w.put(0, 1); });
    if (f.mst) {
      w.put(1, 1); w.put(f.mst, 8);
      if (f.mpts || f.b_mp) { w.put(1, 1); w.put(f.mpts || 0, 6); w.put((f.b_mp || 0) / MST.mpPick, 4); }
      else w.put(0, 1);
    } else w.put(0, 1);
    if (f.qd) {
      w.put(1, 1);
      for (var qb = 0; qb < 4; qb++) w.put(Math.floor(f.qd / Math.pow(2, 8 * qb)) % 256, 8);
    } else w.put(0, 1);
    w.put((f.pq || []).length, 4);
    (f.pq || []).forEach(function (e) { w.put(e[0], 6); w.put(e[1], 3); });
    var h = v9of(f);
    w.put(g.minutes & 15, 4);
    opt21(g.mroom);
    if (f.ngp) {
      if (f.tw) { w.put(1, 1); w.put(f.tw, 8); } else w.put(0, 1);
      opt21(f.twsh || 0);
      opt21(g.twc);
      if (g.ngq.some(Boolean)) { w.put(1, 1); g.ngq.forEach(function (v) { w.put(v, 5); }); } else w.put(0, 1);
      if (g.narc || g.narcx) { w.put(1, 1); w.put(g.narc, 5); w.put(g.narcx, 3); } else w.put(0, 1);
      if (g.ndon || g.npl) { w.put(1, 1); w.put(g.ndon, 2); w.put(g.npl & 15, 4); w.put((g.npl >> 6) & 1, 1); w.put(g.npl >> 7, 1); } else w.put(0, 1);
      if (g.ttl) { w.put(1, 1); w.put(g.ttl, 7); } else w.put(0, 1);
      var cy = f.ngp, cd = [0, 1, 2, 3].filter(function (t) { return t !== D.leadTown[cy]; }).map(function (t) { return h.cdon[t]; });
      if (cd.some(Boolean)) { w.put(1, 1); cd.forEach(function (v) { w.put(v, 8); }); } else w.put(0, 1);
      if (cy) w.put(h.twj & ((1 << cy) - 1), cy);
      if (cy === D.ngpMax) w.put(h.fin & 1, 1);
      var a = Math.floor(h.art / 32);
      if (a) { w.put(1, 1); w.put(a, 25); } else w.put(0, 1);
      if (h.art && V < 15) {
        if (h.aeq.some(Boolean) || h.acos) { w.put(1, 1); h.aeq.forEach(function (v) { w.put(v, 5); }); w.put(h.acos, 2); } else w.put(0, 1);
      }
    }
    if (V >= 10) {
      var bb = bestBits(f.best);
      BS_GROUPS.forEach(function (g) {
        var part = bb.slice(g[0], g[1]);
        if (part.some(Boolean)) { w.put(1, 1); part.forEach(function (v) { w.put(v, 1); }); } else w.put(0, 1);
      });
    }
    if (V >= 11) w.put(f.chart ? 1 : 0, 1);
    if (V >= 12) {
      w.put(f.x8 ? 1 : 0, 1);
      if (f.ever) { w.put(1, 1); w.put(f.ever, V >= 13 ? 6 : 5); } else w.put(0, 1);
      if (V >= 13) putFar(w, f); else w.put(0, 1);
    }
    if (V >= 15) {
      putV15(w, f);
      if (h.aeq.some(Boolean) || h.acos) { w.put(1, 1); h.aeq.forEach(function (v) { w.put(v, 6); }); w.put(h.acos, 2); } else w.put(0, 1);
      var ej = ((f.xq || [])[9] || 0) >> 5;
      var yc = f.yc || 0, zc = f.zc || 0;
      if (ej || yc || zc) {
        w.put(1, 1); optPut(w, ej, 3);
        if (yc || zc) optPut(w, yc, 7);
        if (zc) optPut(w, zc, 7);
      }
    }
    var bits = w.bits.slice();
    while (bits.length % 5) bits.push(0);
    var syms = [];
    for (var i = 0; i < bits.length; i += 5)
      syms.push(bits[i] * 16 + bits[i + 1] * 8 + bits[i + 2] * 4 + bits[i + 3] * 2 + bits[i + 4]);
    var c = crc16(SALT.concat(syms)) & 0x7FFF;
    syms.push((c >> 10) & 31, (c >> 5) & 31, c & 31);
    var lim = V >= 15 ? D.maxSyms : (D.maxSyms14 || 208);
    if (syms.length > lim) throw new Bad("the code is longer than " + lim + " symbols");
    return syms;
  }
  function decode(syms) {
    if (syms.length < 6) throw new Bad("too short");
    var data = syms.slice(0, syms.length - 3);
    var c = crc16(SALT.concat(data)) & 0x7FFF;
    var t = syms.slice(syms.length - 3);
    if (t[0] !== ((c >> 10) & 31) || t[1] !== ((c >> 5) & 31) || t[2] !== (c & 31))
      throw new Bad("the check symbols do not match, probably a typo");
    var r = new Reader(data);
    var ver = r.get(4);
    if (ver < 1 || ver > 15) throw new Bad("unknown code version");
    if (ver < 15 && syms.length > (D.maxSyms14 || 208)) throw new Bad("too long for a version " + ver + " code");
    function opt21() {
      if (!r.get(1)) return 0;
      var v = r.get(8) | (r.get(8) << 8) | (r.get(5) << 16);
      if (!v) throw new Bad("a 21-bit field written as zero");
      return v;
    }
    var v2 = ver >= 2, v4 = ver >= 4, v5 = ver >= 5;
    var f = {};
    f.lv = r.get(ver >= 15 ? 6 : 5);
    var lvMax = ver >= 15 ? D.levels.length : (D.lvX || D.maxLv);
    if (f.lv < 1 || f.lv > lvMax) throw new Bad("LV must be 1 to " + lvMax);
    f.xp = v5 ? D.levels[f.lv - 1][0] + r.get(11) : r.vari(); f.hp = r.get(8); f.mp = r.get(ver >= 15 || !v5 ? 8 : 7); f.gold = v4 ? r.get(14) : r.vari(v2 ? 14 : 16);
    f.pieces = r.get(4); f.saved = r.get(4); f.flags = r.get(v4 ? 5 : 8);
    var xw = ver >= 12 ? 8 : 7, yw = ver >= 14 ? 8 : 7;
    f.x = r.get(xw); f.y = r.get(yw); f.ship_x = r.get(xw); f.ship_y = r.get(yw);
    f.last_town = r.get(v2 ? 2 : 3);
    if (v5) {
      var wi = r.get(4), ai = r.get(4);
      if (wi > WEAPONS.length || ai > ARMORS.length) throw new Bad("unknown weapon or armor");
      f.weapon = wi ? WEAPONS[wi - 1] : 0; f.armor = ai ? ARMORS[ai - 1] : 0;
    } else { f.weapon = r.get(5); f.armor = r.get(5); }
    f.b_atk = r.small(); f.b_def = r.small(); f.b_hp = r.small();
    f.chests = [0, 1, 2, 3].map(function (d) {
      if (ver >= 6) {
        if (!r.get(1)) return 0;
        var c = 0;
        for (var fl = 0; fl < (d < 2 ? 3 : 4); fl++) c |= r.get(3) << (4 * fl);
        if (!c) throw new Bad("chests written as zero");
        return c;
      }
      return v4 ? (r.get(1) ? r.get(16) : 0) : r.vari();
    });
    f.houses = r.get(8);
    var n = r.get(4);
    if (n > D.bagSlots) throw new Bad("the bag has " + D.bagSlots + " slots");
    f.bag = [];
    for (var i = 0; i < n; i++) { var id = r.get(ver >= 15 ? 6 : 5); f.bag.push([id, r.get(4)]); }
    f.quest = QUESTS.map(function (q) { return v2 ? r.get(q.bits) : 0; });
    var g = v8of({});
    if (ver >= 8 && r.get(1)) {
      g.quest_rsv = [r.get(8), r.get(8), r.get(8)];
      if (!g.quest_rsv.some(Boolean)) throw new Bad("record bytes 56-58 written as zero");
    }
    f.ngp = 0; f.xb = [0, 0, 0, 0];
    if (ver >= 3) {
      f.ngp = r.get(4);
      var cmx = ver >= 9 ? D.ngpMax : D.ngpCodeMax;
      if (f.ngp > cmx) throw new Bad("NEW GAME+ cycle must be 0 to " + cmx);
      f.xb = [0, 1, 2, 3].map(function () { return r.get(1) ? r.get(8) : 0; });
    }
    f.mst = 0; f.pq = [];
    var mpts = 0, bmp = 0, qd = 0, twsh = 0;
    if (v4) {
      f.mst = r.get(1) ? r.get(8) : 0;
      if (v5 && f.mst && r.get(1)) { mpts = r.get(6); bmp = MST.mpPick * r.get(4); }
      if (ver >= 7 && r.get(1)) {
        for (var qb = 0; qb < 4; qb++) qd += r.get(8) * Math.pow(2, 8 * qb);
        if (!qd) throw new Bad("the island quests done written as zero");
      }
      var np = r.get(ver >= 8 ? 4 : 3);
      if (np > (ver >= 8 ? 8 : 4)) throw new Bad("too many island quests in progress");
      for (var j = 0; j < np; j++) { var cid = r.get(6); f.pq.push([cid, r.get(3)]); }
    }
    if (ver >= 8) { g.minutes = r.get(ver >= 9 ? 4 : 16); g.mroom = opt21(); }
    var h = v9of({});
    var tw = 0;
    if (ver >= 6 && f.ngp && r.get(1)) {
      if (ver >= 8) {
        tw = r.get(8);
        if (!tw) throw new Bad("the tower written as zero");
      } else {
        var cp = r.get(2), sh = r.get(5);
        if (!cp && !sh) throw new Bad("the tower written as zero");
        tw = cp | (sh << 2);
      }
    }
    if (ver >= 7 && f.ngp && r.get(1)) {
      twsh = r.get(8) | (r.get(8) << 8) | (r.get(5) << 16);
      if (!twsh) throw new Bad("the piano sheets written as zero");
    }
    if (ver >= 8 && f.ngp) {
      g.twc = opt21();
      if (r.get(1)) {
        for (var k = 0; k < 8; k++) g.ngq[k] = r.get(5);
        if (!g.ngq.some(Boolean)) throw new Bad("the journey's quests written as zero");
      }
      if (r.get(1)) {
        g.narc = r.get(5); g.narcx = r.get(3);
        if (g.narc > 16 || !(g.narc || g.narcx)) throw new Bad("the arc");
      }
      if (r.get(1)) {
        g.ndon = r.get(2); g.npl = r.get(4) | (r.get(1) << 6) | (r.get(1) << 7);
        if (!(g.ndon || g.npl)) throw new Bad("the cause written as zero");
      }
      if (r.get(1)) {
        g.ttl = r.get(7);
        if (!g.ttl) throw new Bad("the TITLES written as zero");
      }
      if (ver >= 9) {
        var cy = f.ngp;
        if (r.get(1)) {
          var any = 0;
          for (var t = 0; t < 4; t++) if (t !== D.leadTown[cy]) { h.cdon[t] = r.get(8); any |= h.cdon[t]; }
          if (!any) throw new Bad("the cities' causes written as zero");
        }
        h.twj = cy ? r.get(cy) : 0;
        if (tw & 0x80) h.twj |= 1 << cy;
        if (cy === D.ngpMax) h.fin = r.get(1);
        h.art = (tw >> 2) & 31;
        if (r.get(1)) {
          var a = r.get(25);
          if (!a) throw new Bad("the artifacts written as zero");
          h.art += a * 32;
        }
        if (h.art && ver < 15 && r.get(1)) {
          h.aeq = [r.get(5), r.get(5), r.get(5)]; h.acos = r.get(2);
          if (!(h.aeq.some(Boolean) || h.acos)) throw new Bad("the worn artifacts written as zero");
        }
        h.ttl1 = ttl1Of(h.art, h.fin);
      }
    }
    var best = null;
    if (ver >= 10) {
      var bb = [];
      BS_GROUPS.forEach(function (g) {
        var part = [], k;
        for (k = g[0]; k < g[1]; k++) part.push(0);
        if (r.get(1)) {
          for (k = 0; k < part.length; k++) part[k] = r.get(1);
          if (!part.some(Boolean)) throw new Bad("a bestiary group written as zero");
        }
        bb = bb.concat(part);
      });
      if (bb.some(Boolean)) best = bestHex(bb);
    }
    var chart = (ver >= 11) ? r.get(1) : 0;
    var x8 = 0, ever = 0, far = {};
    if (ver >= 12) {
      x8 = r.get(1);
      if (r.get(1)) { ever = r.get(ver >= 13 ? 6 : 5); if (!ever) throw new Bad("the EVER DONE marks written as zero"); }
      if (ver >= 13) getFar(r, far);
      else if (r.get(1)) throw new Bad("a reserved bit set in a version 12 code");
    }
    var f15 = {};
    if (ver >= 15) getV15(r, f15);
    if (ver >= 15 && r.get(1)) {
      h.aeq = [r.get(6), r.get(6), r.get(6)]; h.acos = r.get(2);
      if (!(h.aeq.some(Boolean) || h.acos)) throw new Bad("the worn artifacts written as zero");
    }
    var ej = 0, yc = 0, zc = 0;
    if (ver >= 15 && r.pos < 5 * data.length) {
      var edge = r.pos % 5 === 0;
      var opt = function (n, what) { if (!r.get(1)) return 0; var v = r.get(n); if (!v) throw new Bad(what + " written as zero"); return v; };
      if (r.get(1)) {
        ej = opt(3, "the tail's first journey");
        if (ej > 6) throw new Bad("the tail: the first journey + 1 is 0 to 6");
        var end = r.pos;
        yc = r.pos < 5 * data.length ? opt(7, "the first far cause") : 0;
        if (yc) end = r.pos;
        zc = r.pos < 5 * data.length ? opt(7, "the second far cause") : 0;
        if (zc) end = r.pos;
        if (!(ej || yc || zc)) throw new Bad("the tail holds nothing");
        r.pos = end;
      } else if (edge) throw new Bad("there are left-over symbols");
    }
    var left = r.bits.slice(r.pos);
    if (Math.floor((r.pos + 4) / 5) !== data.length || left.some(function (b) { return b; }))
      throw new Bad("there are left-over symbols");
    f.mpts = mpts; f.b_mp = bmp; f.tw = tw; f.qd = qd; f.twsh = twsh;
    Object.keys(g).forEach(function (k) { f[k] = g[k]; });
    Object.keys(h).forEach(function (k) { f[k] = h[k]; });
    if (best) f.best = best;
    if (chart) f.chart = 1;
    if (x8) f.x8 = 1;
    if (ever) f.ever = ever;
    if (far.last_town !== undefined) f.last_town = far.last_town;
    if (far.xq) f.xq = far.xq;
    if (far.xd) f.xd = far.xd;
    if (far.xbe) f.xbe = far.xbe;
    if (ej) { f.xq = (f.xq || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).slice(); f.xq[9] |= ej << 5; }
    if (yc) f.yc = yc;
    if (zc) f.zc = zc;
    ["pt", "yg", "yq", "yd", "ybe", "zq", "zd", "zbe"].forEach(function (k) { if (f15[k] !== undefined) f[k] = f15[k]; });
    checkFile(f, ver);
    return f;
  }
  function lvTop(f, ver) {
    var c = (f.x8 && (f.flags & (FL.PASSAGE || 16))) ? (D.lvX || D.maxLv) : D.maxLv;
    if (ver === undefined || ver >= 15) {
      if ((f.xq || [0])[0] >= 10 && D.lvY) c = D.lvY;
      if (((f.zq || [0])[0] & 1) && D.lvZ) c = D.lvZ;
    }
    return c;
  }
  function lvCap(f) {
    var c = lvTop(f, 14);
    if (D.openY && (f.xq || [0])[0] >= 10 && D.lvY) c = D.lvY;
    if (D.openZ && ((f.zq || [0])[0] & 1) && D.lvZ) c = D.lvZ;
    return Math.max(c, f.lv);
  }
  function stats(f) {
    var row = D.levels[f.lv - 1];
    return [Math.min(255, row[1] + f.b_hp), row[2] + (f.b_mp || 0)];
  }
  function migrate(f, refund) {
    var notes = [], k;
    f.mpts = f.mpts || 0; f.b_mp = f.b_mp || 0;
    if (refund && f.mst) {
      var top = f.mst, n = Math.min(top, MST.ptsMax), a = 0, d = 0, h = 0;
      for (k = top - n + 1; k <= top; k++) { if (k & 1) a++; else d++; if (k % 3 === 0) h += 3; }
      f.b_atk = Math.max(0, f.b_atk - a); f.b_def = Math.max(0, f.b_def - d); f.b_hp = Math.max(0, f.b_hp - h);
      f.mpts = n;
      notes.push("The old automatic MASTERY (" + top + " steps) is refunded: ATK -" + a + ", DEF -" + d + ", HP -" + h +
                 ", and " + n + " MASTERY POINTS to spend.");
    }
    var cap = lvCap(f), lim = D.levels[cap - 1][0] + MST.step, got = 0;
    while (f.lv >= cap && f.xp >= lim) {
      if (f.mpts >= MST.ptsMax) { f.xp = lim - 1; break; }
      f.xp -= MST.step; f.mst = Math.min(255, f.mst + 1); f.mpts++; got++;
    }
    if (got) notes.push("XP past LV " + cap + " becomes " + got + " MASTERY POINTS (" + MST.step + " XP each).");
    var m = stats(f);
    f.hp = Math.min(f.hp, m[0]); f.mp = Math.min(f.mp, m[1]);
    return notes;
  }
  function fitNotes(f) {
    var notes = [];
    var p = f.pieces | f.saved;
    if (f.saved & ~f.pieces & 15) notes.push("A freed guardian is missing their piece. Loading adds it.");
    if ((p === 15 || (f.flags & FL.KING_SEALED)) && !(f.flags & FL.HALL_OPEN))
      notes.push("All four pieces without the bridge of light. Loading opens the hall.");
    if ((f.saved & 1) && !(f.flags & FL.SHIP)) notes.push("SERA is freed but there is no ship. Loading gives the ship.");
    var m = stats(f);
    if (f.hp > m[0]) notes.push("HP " + f.hp + " is over this level's maximum. Loading lowers it to " + m[0] + ".");
    if (f.mp > m[1]) notes.push("MP " + f.mp + " is over this level's maximum. Loading lowers it to " + m[1] + ".");
    if (f.xp < D.levels[f.lv - 1][0]) notes.push("XP is below LV " + f.lv + "'s start. Loading raises it to " + D.levels[f.lv - 1][0] + ".");
    return notes;
  }
  function kindAt(x, y) { return x >= 0 && x < KW && y >= 0 && y < 128 ? KINDS[y * KW + x] : 0; }
  function seaReachesDock(x, y) {
    var seen = {}, todo = [[x, y]];
    seen[x + "," + y] = 1;
    while (todo.length) {
      var c = todo.pop();
      var nb = [[c[0] + 1, c[1]], [c[0] - 1, c[1]], [c[0], c[1] + 1], [c[0], c[1] - 1]];
      for (var i = 0; i < 4; i++) {
        var k = kindAt(nb[i][0], nb[i][1]), key = nb[i][0] + "," + nb[i][1];
        if (k === 6) return true;
        if (k === 5 && !seen[key]) { seen[key] = 1; todo.push(nb[i]); }
      }
    }
    return false;
  }
  var SCENE_AT = {};
  D.scene.forEach(function (s) { SCENE_AT[s[0] + "," + s[1]] = s[2]; });
  function cityOf(x, y, grow) {
    grow = grow || 0;
    for (var t = 0; t < D.city.length; t++) {
      var c = D.city[t];
      if (x >= c[0] - grow && x < c[0] + D.cityW + grow && y >= c[1] - grow && y < c[1] + D.cityH + grow) return t;
    }
    return -1;
  }
  function dressed(x, y) { return cityOf(x, y) >= 0 || SCENE_AT.hasOwnProperty(x + "," + y); }
  function nearestOpen(x, y) {
    for (var r = 1; r <= D.rescueR; r++)
      for (var dy = -r; dy <= r; dy++)
        for (var dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          var nx = (x + dx) & 255, ny = (y + dy) & 255, k = kindAt(nx, ny);
          if ((k >= 1 && k <= 3) || k === 6) return [nx, ny];
        }
    return null;
  }
  function fittedFlags(f) {
    var fl = f.flags;
    if (((f.pieces | f.saved) & 15) === 15 || (fl & FL.KING_SEALED)) fl |= FL.HALL_OPEN;
    if (f.saved & 1) fl |= FL.SHIP;
    if (f.x8) fl |= FAR_FLAG;
    return fl;
  }
  var FAR_FLAG = 0x20, FL_ = D.farLand || null;
  function landing(x, y, flags) {
    var F = FL_;
    if (F && F.cliffY0 !== undefined && (flags & FAR_FLAG) && x >= F.x + F.fogW && y >= F.cliffY0 - F.cliffUp && y < 128) {
      var ny = y;
      for (var u = 0; u < F.cliffUp; u++) {
        var k0 = kindAt(x, ny);
        if (k0 !== 0 && k0 !== 12) break;
        if (ny < F.cliffY0 && !(k0 === 0 && (x === F.archX - 1 || x === F.archX + 1))) break;
        ny--;
      }
      if (ny !== y) { var L0 = landing(x, ny, flags); return { x: L0.x, y: L0.y, why: L0.why || "ecliff", town: L0.town }; }
    }
    for (var i = 0; i < D.oldExit.length; i++) {
      var o = D.oldExit[i];
      if (x === o[1] && y === o[2]) return { x: D.townExit[o[0]][0], y: D.townExit[o[0]][1], why: "old", town: o[0] };
    }
    if (F && F.rowY !== undefined && (flags & FAR_FLAG) && y === F.rowY && x >= F.rowX0 && x <= F.rowX1) {
      var kr = kindAt(x, y);
      if (kr !== 5 && kr !== 7 && kr !== 9) return { x: x < F.swapX ? F.mouthX - 3 : F.mouthX1, y: F.mouthY, why: "arch", town: -1 };
    }
    var k = kindAt(x, y);
    if ((k === 5 && (flags & FL.SHIP)) || (k >= 1 && k <= 3) || k === 6 || (k === 4 && (flags & FL.HALL_OPEN)))
      return { x: x, y: y, why: null, town: -1 };
    if (dressed(x, y)) {
      var n = nearestOpen(x, y);
      if (n) return { x: n[0], y: n[1], why: "rescue", town: cityOf(x, y) };
    }
    if (F && x >= F.x && y < 128 && (flags & FAR_FLAG)) return { x: F.exit[0], y: F.exit[1], why: "far", town: -1 };
    return { x: D.townExit[0][0], y: D.townExit[0][1], why: "coda", town: -1 };
  }
  function placeNotes(f) {
    var notes = [], k = kindAt(f.x, f.y), fl = fittedFlags(f), L = landing(f.x, f.y, fl);
    if (L.why === "old") {
      notes.push("That is " + D.towns[L.town] + "'s gate from before the walled cities. The game shows " + D.towns[L.town] +
                 " and starts Arden at its gate now, " + L.x + "," + L.y + ".");
    } else if (L.why === "rescue") {
      var near = cityOf(L.x, L.y, 1);
      notes.push("Arden can't stand on that cell (" + (L.town >= 0 ? D.towns[L.town] + "'s city walls" : "a ruin, house or other scenery") +
                 "), so the game moves him to the nearest open cell, " + L.x + "," + L.y + (near >= 0 ? " beside " + D.towns[near] : "") + ".");
    } else if (L.why === "coda") {
      notes.push("Arden can't stand on that cell, so the game moves him to CODA's gate.");
    } else if (L.why === "far") {
      notes.push("Arden can't stand on that cell, so the game moves him to the first town's gate across the sea, " + L.x + "," + L.y + ".");
    } else if (L.why === "arch") {
      notes.push("That cell is on the old archway row, so the game moves him, aboard, to the archway's mouth, " + L.x + "," + L.y + ".");
    } else if (L.why === "ecliff") {
      notes.push("That cell is on the old cliff rows, so the game moves him up the column to " + L.x + "," + L.y + ".");
    }
    var wing = f.bag.some(function (e) { return ITEMS[e[0]].name === "WING"; });
    if (k === 5 && (fl & FL.SHIP) && !seaReachesDock(f.x, f.y) && !wing)
      notes.push("Arden is at sea where no dock can be reached, with no WING: he would be stuck.");
    return notes;
  }
  function parseCode(text) {
    var s = String(text).toUpperCase().replace(/[\s\-]/g, "");
    var bad = s.split("").filter(function (ch) { return A.indexOf(ch) < 0; });
    if (bad.length) {
      var uniq = bad.filter(function (ch, i) { return bad.indexOf(ch) === i; }).join(" ");
      throw new Bad("these characters are not in a TALE CODE: " + uniq + " (codes never use I, O, 0 or 1)");
    }
    return s.split("").map(function (ch) { return A.indexOf(ch); });
  }
  function codeRows(syms) {
    var s = syms.map(function (v) { return A[v]; }).join(""), rows = [];
    for (var r = 0; r < s.length; r += 16) {
      var row = s.slice(r, r + 16), g = [];
      for (var i = 0; i < row.length; i += 4) g.push(row.slice(i, i + 4));
      rows.push(g.join(" "));
    }
    return rows;
  }
  function clone(f) { return JSON.parse(JSON.stringify(f)); }
  function ngqPicks(c) {
    var N = D.ngq, P = N.pool, out = [], used = 0, i, e, d, want;
    if (!c) return out;
    want = 6 + (c >= 3 ? 1 : 0) + (c >= D.ngpMax ? 1 : 0);
    i = (c * 16) % P.length;
    for (var t = 0; t < P.length && out.length < want; t++) {
      e = i;
      i = (i + 11) % P.length;
      if ((used >> (e & 15)) & 1) continue;
      d = P[e];
      if (d.mincyc > c || ((d.type === "DELIVER" || d.type === "PLAY") && d.tgtFrom > c)) continue;
      used |= 1 << (e & 15);
      out.push(e);
    }
    [[1, 6, 11], [4, 7, 18], [5, 5, 6], [5, 7, 17]].forEach(function (f) {
      if (f[0] !== c) return;
      d = P[f[2]];
      if ((d.type === "DELIVER" || d.type === "PLAY") && d.tgtFrom > c) return;
      if (f[1] < out.length) out[f[1]] = f[2]; else out.push(f[2]);
    });
    return out;
  }
  function arcOf(c) { return c ? D.ngq.arcs[D.ngq.arcof[c]] : null; }
  function causeOf(c) { return c ? D.ngq.causes[D.ngq.causeof[c]] : null; }
  function dayWord(m) { m &= 15; return m < 10 ? "DAY" : m === 10 ? "DUSK" : m === 15 ? "DAWN" : "NIGHT"; }
  function codeVersion(syms) { return syms.length ? syms[0] >> 1 : 0; }
  return { farFix: farFix, farJ: farJ, v15of: v15of, needs15: needs15, verOf: verOf, ybeCount: ybeCount, zbeCount: zbeCount, bitsOf: bitsOf, xbeCount: xbeCount, bestBits: bestBits, bestHex: bestHex, bestCount: bestCount, v9of: v9of, v9Fit: v9Fit, ttl1Of: ttl1Of, artHas: artHas, encode: encode, decode: decode, migrate: migrate, lvCap: lvCap, lvTop: lvTop,
 keyMigrate: keyMigrate, towerFit: towerFit, v8of: v8of, ngqPicks: ngqPicks, arcOf: arcOf, causeOf: causeOf, dayWord: dayWord, qdHas: qdHas, checkFile: checkFile, fitNotes: fitNotes, placeNotes: placeNotes, landing: landing,
           parseCode: parseCode, codeRows: codeRows, stats: stats, kindAt: kindAt, isGear: isGear, kindOf: kindOf,
           clone: clone, codeVersion: codeVersion, Bad: Bad, FL_MASK: FL_MASK, KINDS: KINDS };
}
if (typeof module !== "undefined") module.exports = makeTaleCore;
var D = DATA, TC = makeTaleCore(D), FL = D.flags;
function pop(n) { var c = 0; while (n) { c += n & 1; n >>= 1; } return c; }
  var SET_TITLES = ["SALON CONFIDANT", "TAMER OF LEGENDS", "TOAST OF PARIS", "SON OF MAZOVIA", "KEEPER OF NIGHT"];
  var RN6 = ["I", "II", "III", "IV", "V", "VI"];
  var FA = D.farA || { j: [], b: [] }, FAT = {};
  function farText(i) {
    if (FAT[i]) return FAT[i];
    var s = typeof atob === "function" ? atob(FA.b[i]) : Buffer.from(FA.b[i], "base64").toString("binary"), k = (0x35 + FA.j[i] * 11) & 0x7F, t = "";
    for (var n = 0; n < s.length; n++) { t += String.fromCharCode(s.charCodeAt(n) ^ (0x80 | (k & 0x7F))); k = (k + 29) & 0xFF; }
    return (FAT[i] = JSON.parse(t));
  }
  function farAch(f) {
    var Z = function (n) { var z = []; while (n--) z.push(0); return z; };
    var xq = f.xq || Z(10), xd = f.xd || Z(6), yq = f.yq || Z(14), yd = f.yd || Z(6), zq = f.zq || Z(10), zd = f.zd || Z(6);
    var be = TC.bitsOf(f.xbe, 81), bs = TC.bitsOf(f.ybe, 70), bx = TC.bitsOf(f.zbe, 70);
    var cnt = function (a) { return a.filter(Boolean).length; };
    var boss = function (b, k, o1, o2) { return !!(b[k] || b[o1 + k] || b[o2 + k]); };
    var eb = xq[0], wk = pop((xq[1] >> 1) & 7), er = 0, k;
    for (k = 0; k < 8; k++) if (((xq[2 + (k >> 2)] >> (2 * (k & 3))) & 3) === 3) er++;
    var e7 = pop(xq[6] & 31), ebn = cnt(be);
    var sb = yq[0] & 15, sk = yq[11], sw = yq[12], sf = yd[4], s8 = pop(sk & 31), sbn = cnt(bs);
    var xb = zq[1] & 15, xw = zq[0], xf = zd[4], sl = zd[5], x7 = 0, xbn = cnt(bx);
    var yc = (f.yc || 0) & 3, zc = (f.zc || 0) & 3;
    [0, 1, 2, 3, 4, 5, 7].forEach(function (q) { if ((zq[2 + q] & 3) === 3 || (q === 4 && (xw & 0x20))) x7++; });
    var x9 = cnt([sl & 1, sl & 2, xw & 0x20, (zq[3] & 3) === 3, sl & 4]);
    var r = [!!FA.b[0] && !!f.x8, !!FA.b[1] && !!D.openY && !!f.yg, !!FA.b[2] && !!D.openZ && !!(xw & 1)];
    return [
      { r: r[0], n: [null, null, wk, null, null, er, xq[5] & 3, e7, null, ebn],
        on: [f.x8, eb >= 4 || (xd[4] & 1) || boss(be, 24, 27, 54), wk === 3, eb >= 9 || (xd[4] & 2) || boss(be, 26, 27, 54),
             eb >= 10 || ((f.ever || 0) & 32), er === 8, (xq[5] & 3) === 3, e7 === 5, ((xq[7] >> 2) & 7) > 0, ebn === 81] },
      { r: r[1], n: [null, null, null, null, null, null, null, null, s8, null, sbn, yc],
        on: [f.yg, sb >= 4 || (sf & 1) || boss(bs, 20, 24, 47), sb >= 6 || (sf & 2) || boss(bs, 21, 24, 47),
             sb >= 9 || (sf & 4) || boss(bs, 22, 24, 47), sb >= 10 || (sk & 0x20) || (yq[13] & 1) || (sw & 4), sw & 8, sk & 0x40, sk & 0x80,
             s8 === 5, bs[23] || (sf & 0x80), sbn === 70, yc === 3] },
      { r: r[2], n: [null, null, null, null, null, null, null, x7, x9, null, xbn, zc],
        on: [xw & 1, xb >= 4 || (xf & 1) || boss(bx, 20, 24, 47), xb >= 6 || (xf & 2) || boss(bx, 21, 24, 47),
             xb >= 11 || (xf & 4) || (xw & 8) || boss(bx, 22, 24, 47), xb >= 12 || (xw & 8), xw & 0x10, (zq[9] & 3) === 3, x7 === 7, x9 === 5,
             bx[23] || (xf & 0x80), xbn === 70, zc === 3] }
    ].map(function (s) { s.on = s.on.map(function (v) { return !!v; }); return s; });
  }
  var FAR_W = [[1, 2, 1, 2, 3, 1, 1, 1, 1, 3], [1, 2, 2, 2, 3, 1, 1, 1, 1, 2, 3, 1], [1, 2, 2, 2, 3, 3, 1, 1, 1, 2, 3, 1]];
  function farSum(L) {
    var r = { got: 0, total: 0, hid: 0 };
    L.forEach(function (b) { if (!b.far) return; if (b.hide) { if (!b.on) r.hid++; } else { r.total++; if (b.on) r.got++; } });
    return r;
  }
  function achievements(f) {
    var A = [], c = f.ngp || 0, v9 = TC.v9of(f), art = v9.art, fin = v9.fin & 1, sealed = (f.flags & FL.KING_SEALED) !== 0;
    var ttl = f.ttl || 0, ttl1 = TC.ttl1Of(art, v9.fin) | (v9.ttl1 || 0), xb = f.xb || [0, 0, 0, 0];
    var add = function (grp, name, sub, w, on, big) { A.push({ grp: grp, name: name, sub: sub, w: w, on: !!on, big: !!big }); };
    for (var j = 0; j <= D.ngpMax; j++)
      add("Journeys", j ? "NEW GAME+ " + j : "THE FIRST TALE", "THE SILENT KING beaten on journey " + j, 3, j < c || (j === c && (sealed || fin)));
    add("Journeys", "COMPLETE", "the finale on NEW GAME+ " + D.ngpMax + " - title: GUARDIAN OF THE NOCTURNE", 6, fin || (ttl1 & 0x80), true);
    for (j = 1; j <= D.ngpMax; j++) add("The Nocturne Tower", "TOWER " + RN6[j - 1], "CZARNOBOG fell on journey " + j, 2, ((v9.twj >> j) & 1) || (j === c && ((f.tw || 0) & 0x80)));
    add("The Nocturne Tower", "ALL TOWER BOSSES", "every artifact of sets I-V", 2, (art & 0x1FFFFFF) === 0x1FFFFFF);
    var nArt = 0; for (var i = 0; i < 30; i++) if (TC.artHas(art, i)) nArt++;
    add("Artifacts", "FIRST ARTIFACT", nArt + " / 30 found", 1, nArt > 0);
    for (var s = 0; s < 6; s++)
      add("Artifacts", "SET " + RN6[s] + " WHOLE", s < 5 ? "title: " + SET_TITLES[s] : "the hidden floor finds", 1, ((art >> (5 * s)) & 31) === 31);
    add("Artifacts", "ALL 30 ARTIFACTS", "title: MASTER CURATOR", 3, art === 0x3FFFFFFF, true);
    var isl = (D.isles || []).filter(function (e) { return e.quest; });
    var islOk = c >= D.ngpMax && isl.every(function (e) { return TC.qdHas(f.qd || 0, e.cid); });
    var qn = f.quest.filter(function (v, k) { return v >= D.quests[k].max; }).length;
    var cd = v9.cdon.filter(function (v) { return ((v >> 4) & 3) === 3; }).length + (((f.ndon || 0) & 3) === 3 ? 1 : 0);
    var mr = pop((f.mroom || 0) & 0x1FFFFF);
    var ev = f.ever || 0, EV = " (earned on an earlier journey)";
    add("The World", "MAP COMPLETE", (f.chart ? "the whole world charted" : "the cartographer's SEXTANT") + ((ev & 16) && !(f.chart || (xb[3] & 0x30)) ? EV : ""), 1, f.chart || (xb[3] & 0x30) || (ev & 16));
    add("The World", "ISLANDS SETTLED", "all arrived, " + isl.filter(function (e) { return TC.qdHas(f.qd || 0, e.cid); }).length + " / " + isl.length + " island quests" + ((ev & 2) && !islOk ? EV : ""), 1, islOk || (ev & 2));
    add("The World", "MUSIC ROOM", mr + " / 21 nocturnes heard" + ((ev & 8) && mr !== 21 ? EV : ""), 1, mr === 21 || (ev & 8));
    add("The World", "ALL SIDE QUESTS", qn + " / " + f.quest.length + " done" + ((ev & 1) && qn !== f.quest.length ? EV : ""), 1, qn === f.quest.length || (ev & 1));
    add("The World", "EVERY CAUSE FUNDED", cd + " / " + v9.cdon.length + " cities' causes at tier 3 this journey" + ((ev & 4) && cd !== v9.cdon.length ? EV : ""), 1, cd === v9.cdon.length || (ev & 4));
    for (var t = 0; t < 7; t++) add("Titles", D.ngq.titles[t], "", 1, (ttl >> t) & 1);
    var bsN = D.bsN || 129, bs = f.best ? TC.bestCount(f) : 0;
    add("Bestiary", "FIRST PAGE", bs + " / " + bsN + " entries", 1, bs > 0);
    add("Bestiary", "HALF THE BESTIARY", Math.ceil(bsN / 2) + " entries", 2, 2 * bs >= bsN);
    add("Bestiary", "THE WHOLE BESTIARY", "every monster and boss, every NEW GAME+ colour", 3, bs === bsN, true);
    var FB = farAch(f);
    FB.forEach(function (sea, i) {
      var t = sea.r ? farText(i) : null;
      sea.on.forEach(function (on, k) {
        var b = !t ? { grp: "", name: "", sub: "", w: FAR_W[i][k], on: false, big: false, hide: true } :
          { grp: t[0], name: t[1][k][0], sub: t[1][k][1].replace("#", sea.n[k] === null ? "" : String(sea.n[k])), w: FAR_W[i][k], on: on, big: !!t[1][k][2] };
        b.far = true;
        A.push(b);
      });
    });
    var tot = 3, got = 3 * bs / bsN, n = 0, nc = 0;
    A.forEach(function (b) { if (b.sec) return; nc++; tot += b.w; if (b.on) { got += b.w; n++; } });
    var all = n === nc;
    A.push({ grp: "Titles", name: "100%", sub: "every other badge", w: 0, on: all, big: true });
    if (all) n++;
    return { list: A, pct: all ? 100 : Math.min(99, Math.floor(100 * got / tot)), badges: n, total: nc + 1,
             journey: c, complete: !!fin, ver: 9, bsf: bs / bsN, far: farSum(A) };
  }
  function achEarned(a) { var e = []; a.list.forEach(function (b, i) { if (b.on && b.w && !b.sec) e.push(i); }); return e; }
  function achUnion(a, earned, floorPct, oldComplete) {
    var set = {}, tot = 3, got = 3 * (a.bsf || 0), n = 0, nc = 0, last = a.list.length - 1;
    (earned || []).forEach(function (i) { set[i] = 1; });
    var list = a.list.map(function (b, i) {
      if (i === last) return b;
      var on = b.on || !!set[i], x = { grp: b.grp, name: b.name, sub: b.sub, w: b.w, on: on, big: b.big, earlier: on && !b.on, far: b.far, hide: b.hide };
      nc++; tot += b.w; if (on) { got += b.w; n++; }
      return x;
    });
    var all = n === nc, ci = 0;
    list.forEach(function (b, i) { if (b.name === "COMPLETE" && b.grp === "Journeys") ci = i; });
    list[last] = { grp: "Titles", name: "100%", sub: "every other badge", w: 0, on: all, big: true, earlier: all && !a.list[last].on };
    if (all) n++;
    var pct = all ? 100 : Math.max(floorPct || 0, Math.min(99, Math.floor(100 * got / tot)));
    return { list: list, pct: pct, badges: n, total: a.total, journey: a.journey, complete: a.complete || !!oldComplete || list[ci].on,
             ver: a.ver, bsf: a.bsf, far: farSum(list), earned: list.slice(0, last).map(function (b, i) { return b.on && !b.sec ? i : -1; }).filter(function (i) { return i >= 0; }) };
  }
function achRaw(code) {
  try { var syms = TC.parseCode(String(code || "")); if (TC.codeVersion(syms) < 9) return null; return achievements(TC.decode(syms)); }
  catch (e) { return null; }
}
function pub(r) { if (r) r.list = r.list.filter(function (b) { return !b.hide; }); return r; }
window.NGPC_ACH_GN = {
  name: "Guardians of the Nocturne",
  fromCode: function (code) { return pub(achRaw(code)); },
  fromEntry: function (d) {
    var a = d ? achRaw(d.code) : null;
    return pub(a && Array.isArray(d.earned) ? achUnion(a, d.earned, d.pct, d.complete) : a);
  }
};
})();
