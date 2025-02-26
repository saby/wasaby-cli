const RC_BRANCH_LENGTH = 7;

function getMinorVersionBranch(upVersions, downVersions) {
   if (downVersions.length !== 0) {
      return downVersions.sort((current, next) => current - next).pop();
   }

   if (upVersions.length !== 0) {
      return upVersions.sort((current, next) => current - next).shift();
   }
}

/**
 * Определяет rc ветку из имени переданной ветки.
 * @param branch {String} Имя ветки из которой надо опредилть rc.
 * @returns {String}
 */
function getRcBranch(branch) {
   const rc = branch.split('/')[0];

   if (rc.length === RC_BRANCH_LENGTH && rc.includes('.')) {
      return `rc-${rc}`;
   }

   return undefined;
}

/**
 * Пытается найти ближайшую rc ветку к пользовательской.
 * @param userRcBranch - rc ветка переданная пользователем.
 * @param repository {Repository} - Репозиторий в котором нужно произвести поиск.
 * @returns {Promise<String>}
 */
async function getNearestRcBranch(userRcBranch, repository) {
   const mask = `${userRcBranch.slice(0, userRcBranch.lastIndexOf('.') + 2)}*`;
   const rcBranches = await repository.getRemoteBranches(mask);

   if (rcBranches.length === 0) {
      throw new Error(`Repository ${repository.url} hasn't branches are starting with "${mask}"`);
   }

   if (rcBranches.includes(userRcBranch)) {
      return userRcBranch;
   }

   const numberVersionRC = +userRcBranch.slice(userRcBranch.lastIndexOf('.') + 1);
   const numbersUpVersBranches = [];
   const numbersDownVersBranches = [];

   for (const branch of rcBranches) {
      const numberVersionBranch = +branch.slice(branch.lastIndexOf('.') + 1);

      if (typeof numberVersionBranch === 'number') {
         if (numberVersionRC < numberVersionBranch) {
            numbersUpVersBranches.push(numberVersionBranch);
         }

         if (numberVersionRC > numberVersionBranch) {
            numbersDownVersBranches.push(numberVersionBranch);
         }
      }
   }

   if (numbersUpVersBranches.length === 0 && numbersDownVersBranches.length === 0) {
      return userRcBranch;
   }

   const majorRcVersion = userRcBranch.slice(0, userRcBranch.lastIndexOf('.') + 1);
   const minorRcVersion = getMinorVersionBranch(numbersUpVersBranches, numbersDownVersBranches);

   return `${majorRcVersion}${minorRcVersion}`;
}

function isRcBranch(branch) {
   return branch.startsWith('rc-');
}

module.exports = {
   isRcBranch,
   getRcBranch,
   getNearestRcBranch
};
